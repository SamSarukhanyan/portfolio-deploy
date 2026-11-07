"""One inference session per camera connection: its own model, settings and tracker state."""
import base64
import time

import cv2
import numpy as np

from .config import DEVICE
from .registry import takes_prompts, load_model

TRACKABLE = {"detect", "segment", "pose", "obb"}

DEFAULTS = {
    "model": "yolo26n.pt",
    "conf": 0.25,
    "iou": 0.7,
    "imgsz": 640,
    "max_det": 100,
    "classes": None,  # list of class indices to keep, None = all
    "track": False,
    "tracker": "bytetrack",  # bytetrack | botsort
    "prompts": None,  # YOLO-World open-vocabulary class names
    "augment": False,
    "agnostic_nms": False,
}


class Session:
    def __init__(self):
        self.cfg = dict(DEFAULTS)
        self.model = None
        self.model_id = None
        self.tracker_key = None
        self.prompts_key = None

    @property
    def task(self):
        return getattr(self.model, "task", None)

    def names(self):
        return {int(k): v for k, v in (self.model.names or {}).items()}

    def configure(self, update: dict) -> dict:
        cfg = {**self.cfg, **{k: v for k, v in update.items() if k in DEFAULTS}}
        info = {"load_ms": 0}
        tracker_key = (cfg["track"], cfg["tracker"])
        prompts = [p.strip() for p in (cfg.get("prompts") or []) if p and p.strip()]
        prompts_key = tuple(prompts)

        # A tracker keeps state on the predictor, so changing it means a fresh model.
        if self.model is None or cfg["model"] != self.model_id or tracker_key != self.tracker_key:
            t0 = time.perf_counter()
            self.model = load_model(cfg["model"])
            self.model_id = cfg["model"]
            self.tracker_key = tracker_key
            self.prompts_key = None
            info["load_ms"] = round((time.perf_counter() - t0) * 1000)

        if takes_prompts(self.model_id) and prompts and prompts_key != self.prompts_key:
            t0 = time.perf_counter()
            self.model.set_classes(prompts)
            self.prompts_key = prompts_key
            info["prompts_ms"] = round((time.perf_counter() - t0) * 1000)

        self.cfg = cfg
        return {"model": self.model_id, "task": self.task, "names": self.names(), **info}

    def infer(self, img: np.ndarray) -> dict:
        c = self.cfg
        kw = dict(
            conf=float(c["conf"]),
            iou=float(c["iou"]),
            imgsz=int(c["imgsz"]),
            max_det=int(c["max_det"]),
            classes=c["classes"] or None,
            augment=bool(c["augment"]),
            agnostic_nms=bool(c["agnostic_nms"]),
            device=DEVICE,
            verbose=False,
        )
        if c["track"] and self.task in TRACKABLE:
            results = self.model.track(img, persist=True, tracker=f"{c['tracker']}.yaml", **kw)
        else:
            results = self.model.predict(img, **kw)
        return serialize(results[0], self.task)


def decode_jpeg(data: bytes) -> np.ndarray:
    img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("could not decode image")
    return img


def _r(v, nd=1):
    return round(float(v), nd)


def _poly(arr, eps=1.0):
    if arr is None or len(arr) < 3:
        return []
    approx = cv2.approxPolyDP(np.asarray(arr, np.float32).reshape(-1, 1, 2), eps, True).reshape(-1, 2)
    return [[_r(x), _r(y)] for x, y in approx]


def serialize(r, task) -> dict:
    h, w = r.orig_shape
    names = r.names
    out = {"w": int(w), "h": int(h), "task": task, "speed": {k: _r(v, 2) for k, v in (r.speed or {}).items()}}
    dets = []

    if r.boxes is not None and len(r.boxes):
        b = r.boxes
        xyxy = b.xyxy.cpu().numpy()
        conf = b.conf.cpu().numpy()
        cls = b.cls.cpu().numpy().astype(int)
        ids = b.id.int().cpu().tolist() if b.id is not None else None
        polys = r.masks.xy if r.masks is not None else None
        kpts = r.keypoints.data.cpu().numpy() if r.keypoints is not None else None
        for i in range(len(xyxy)):
            d = {"cls": int(cls[i]), "name": names[int(cls[i])], "conf": _r(conf[i], 3), "box": [_r(v) for v in xyxy[i]]}
            if ids is not None:
                d["id"] = ids[i]
            if polys is not None and i < len(polys):
                d["poly"] = _poly(polys[i])
            if kpts is not None:
                d["kpts"] = [[_r(x), _r(y), _r(s, 2)] for x, y, s in kpts[i]]
            dets.append(d)

    if getattr(r, "obb", None) is not None and len(r.obb):
        o = r.obb
        corners = o.xyxyxyxy.cpu().numpy()
        xyxy = o.xyxy.cpu().numpy()
        conf = o.conf.cpu().numpy()
        cls = o.cls.cpu().numpy().astype(int)
        ids = o.id.int().cpu().tolist() if o.id is not None else None
        for i in range(len(corners)):
            d = {
                "cls": int(cls[i]),
                "name": names[int(cls[i])],
                "conf": _r(conf[i], 3),
                "box": [_r(v) for v in xyxy[i]],
                "obb": [[_r(x), _r(y)] for x, y in corners[i]],
            }
            if ids is not None:
                d["id"] = ids[i]
            dets.append(d)

    if r.probs is not None:
        p = r.probs
        out["top5"] = [
            {"cls": int(i), "name": names[int(i)], "conf": _r(c, 4)} for i, c in zip(p.top5, p.top5conf.cpu().tolist())
        ]

    if getattr(r, "semantic_mask", None) is not None:
        out["semantic"] = _semantic(r.semantic_mask.data, names)
    if getattr(r, "depth", None) is not None:
        out["depth"] = _depth(r.depth.data)

    out["detections"] = dets
    return out


DENSE_MAX = 480  # dense maps are downscaled before they go over the wire


def _small(a: np.ndarray, interp) -> np.ndarray:
    h, w = a.shape[:2]
    s = min(1.0, DENSE_MAX / max(h, w))
    return cv2.resize(a, (max(1, int(w * s)), max(1, int(h * s))), interpolation=interp) if s < 1 else a


def _png(img: np.ndarray) -> str:
    ok, buf = cv2.imencode(".png", img)
    return "data:image/png;base64," + base64.b64encode(buf.tobytes()).decode()


def _class_color(c: int):
    hue = (c * 47) % 180
    bgr = cv2.cvtColor(np.uint8([[[hue, 200, 255]]]), cv2.COLOR_HSV2BGR)[0, 0]
    return [int(v) for v in bgr]


def _semantic(data, names) -> dict:
    m = data.cpu().numpy().astype(np.int32) if hasattr(data, "cpu") else np.asarray(data, np.int32)
    m = _small(m.astype(np.uint16), cv2.INTER_NEAREST).astype(np.int32)
    ids, counts = np.unique(m, return_counts=True)
    rgba = np.zeros((*m.shape, 4), np.uint8)
    for c in ids:
        rgba[m == c] = [*_class_color(int(c)), 255]
    total = m.size
    classes = [
        {"cls": int(c), "name": names.get(int(c), str(c)), "share": round(int(n) / total, 4)}
        for c, n in sorted(zip(ids, counts), key=lambda t: -t[1])
    ]
    return {"png": _png(rgba), "classes": classes[:20]}


def _depth(data) -> dict:
    d = data.cpu().numpy() if hasattr(data, "cpu") else np.asarray(data)
    d = np.squeeze(d).astype(np.float32)
    lo, hi = float(np.nanmin(d)), float(np.nanmax(d))
    norm = ((d - lo) / (hi - lo + 1e-6) * 255).astype(np.uint8)
    color = cv2.applyColorMap(_small(norm, cv2.INTER_LINEAR), cv2.COLORMAP_INFERNO)
    return {"png": _png(color), "min": round(lo, 3), "max": round(hi, 3)}
