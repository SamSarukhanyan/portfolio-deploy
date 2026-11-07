"""Which models exist, where their weights live and how to load them."""
import ast
import re
from pathlib import Path

import yaml

from .config import DATA_DIR, MODELS_DIR, RUNS_DIR, inside_data, rel

FAMILIES = ["yolo26", "yolo11", "yolov8"]  # newest first
SIZES = ["n", "s", "m", "l", "x"]
TASK_SUFFIX = {
    "detect": "",
    "segment": "-seg",
    "pose": "-pose",
    "obb": "-obb",
    "classify": "-cls",
    "semantic": "-sem",
    "depth": "-depth",
}

# Specialised official models, beyond the plain YOLO families.
EXTRAS = [
    ("yoloe-26s-seg", "segment", "yoloe", "YOLOE-26: найдёт что угодно по словам (открытый словарь)"),
    ("yoloe-26s-seg-pf", "segment", "yoloe", "YOLOE-26 без подсказок: ~4500 классов"),
    ("yolov8s-worldv2", "detect", "world", "YOLO-World v2: детекция по любым словам"),
    ("yolov8n-oiv7", "detect", "oiv7", "YOLOv8 Open Images V7: 600 классов"),
    ("rtdetr-l", "detect", "rtdetr", "RT-DETR: трансформер-детектор"),
    ("FastSAM-s", "segment", "fastsam", "FastSAM: сегментация всего подряд"),
]

OFFICIAL_RE = re.compile(r"^[A-Za-z0-9._-]+\.pt$")


def _known_stems():
    try:
        from ultralytics.utils.downloads import GITHUB_ASSETS_STEMS

        return set(GITHUB_ASSETS_STEMS)
    except Exception:
        return None


def _run_task(run_dir: Path):
    args = run_dir / "args.yaml"
    if args.exists():
        try:
            return (yaml.safe_load(args.read_text()) or {}).get("task")
        except Exception:
            return None
    return None


def catalog():
    stems = _known_stems()
    items = []
    for fam in FAMILIES:
        for task, suffix in TASK_SUFFIX.items():
            for size in SIZES:
                stem = f"{fam}{size}{suffix}"
                if stems is not None and stem not in stems:
                    continue
                items.append(
                    {
                        "id": f"{stem}.pt",
                        "task": task,
                        "family": fam,
                        "size": size,
                        "kind": "official",
                        "downloaded": (MODELS_DIR / f"{stem}.pt").exists(),
                    }
                )
    for stem, task, kind, title in EXTRAS:
        if stems is not None and stem not in stems:
            continue
        items.append(
            {
                "id": f"{stem}.pt",
                "task": task,
                "family": kind,
                "kind": kind,
                "title": title,
                "downloaded": (MODELS_DIR / f"{stem}.pt").exists(),
            }
        )
    for best in sorted(RUNS_DIR.glob("*/weights/best.pt"), key=lambda p: p.stat().st_mtime, reverse=True):
        run_dir = best.parents[1]
        items.append(
            {
                "id": rel(best),
                "task": _run_task(run_dir) or "detect",
                "family": "custom",
                "kind": "custom",
                "title": f"Ваша модель: {run_dir.name}",
                "downloaded": True,
            }
        )
    return items


def onnx_models():
    """Exported ONNX files the browser engine can run, with Ultralytics metadata."""
    import onnx

    out = []
    for path in sorted(list(MODELS_DIR.glob("*.onnx")) + list(RUNS_DIR.glob("*/weights/*.onnx"))):
        try:
            meta = {p.key: p.value for p in onnx.load(str(path), load_external_data=False).metadata_props}
        except Exception:
            meta = {}
        names = meta.get("names")
        imgsz = meta.get("imgsz")
        try:
            names = ast.literal_eval(names) if names else {}
            imgsz = ast.literal_eval(imgsz) if imgsz else [640, 640]
        except Exception:
            names, imgsz = {}, [640, 640]
        out.append(
            {
                "path": rel(path),
                "task": meta.get("task", "detect"),
                "names": {int(k): v for k, v in names.items()},
                "imgsz": imgsz,
                "end2end": meta.get("end2end") == "True",
                "size_mb": round(path.stat().st_size / 1e6, 1),
            }
        )
    return out


def resolve_weights(model_id: str) -> Path:
    if "/" in model_id:
        p = inside_data(model_id)
        if not p.exists():
            raise FileNotFoundError(model_id)
        return p
    if not OFFICIAL_RE.match(model_id):
        raise ValueError(f"bad model id: {model_id}")
    # A missing official file is downloaded by Ultralytics into this path.
    return MODELS_DIR / model_id


def load_model(model_id: str):
    path = resolve_weights(model_id)
    name = path.name.lower()
    if name.startswith("rtdetr"):
        from ultralytics import RTDETR

        return RTDETR(str(path))
    if name.startswith("fastsam"):
        from ultralytics import FastSAM

        return FastSAM(str(path))
    # YOLO() itself picks YOLOWorld / YOLOE from the file name.
    from ultralytics import YOLO

    return YOLO(str(path))


def takes_prompts(model_id: str) -> bool:
    """Open-vocabulary models that detect whatever words you give them."""
    n = model_id.lower()
    return "world" in n or ("yoloe" in n and "-pf" not in n)


__all__ = ["catalog", "onnx_models", "load_model", "resolve_weights", "takes_prompts", "DATA_DIR"]
