import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { canvasToBlob, get, patch, post, postForm, store } from "../api";
import { drawResult, updateTracks, type DrawOpts, type Trails } from "../draw";
import { BROWSER_TASKS, BrowserEngine } from "../engines/browser";
import { ServerEngine, type ServerConfig } from "../engines/server";
import { toAnnotations } from "./Datasets";
import { TASK_LABEL, type Dataset, type InferResult, type ModelInfo, type OnnxModel, type Task } from "../types";

type Source = "camera" | "video" | "image";
type EngineKind = "server" | "browser";

const DEFAULT_CFG: ServerConfig = {
  model: "yolo26n.pt",
  conf: 0.25,
  iou: 0.7,
  imgsz: 640,
  max_det: 100,
  classes: null,
  track: false,
  tracker: "bytetrack",
  prompts: null,
  augment: false,
  agnostic_nms: false,
};

const DEFAULT_DRAW: DrawOpts = { boxes: true, labels: true, masks: true, kpts: true, trails: true, dense: 0.55 };

interface Stats {
  fps: number;
  rtt: number;
  server: number;
  speed: Record<string, number>;
  frames: number;
  avg: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function Live({ models, onnx, liveModel }: { models: ModelInfo[]; onnx: OnnxModel[]; liveModel: { id: string; n: number } | null }) {
  const [engineKind, setEngineKind] = useState<EngineKind>(() => store.get("engine", "server"));
  const [source, setSource] = useState<Source>("camera");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string>(() => store.get("camera", ""));
  const [cfg, setCfg] = useState<ServerConfig>(() => ({ ...DEFAULT_CFG, ...store.get("cfg", {}) }));
  const [promptsText, setPromptsText] = useState<string>(() => store.get("prompts", "person, phone, cup, keys"));
  const [browserModel, setBrowserModel] = useState<string>(() => store.get("browserModel", ""));
  const [draw, setDraw] = useState<DrawOpts>(() => ({ ...DEFAULT_DRAW, ...store.get("draw", {}) }));
  const [mirror, setMirror] = useState<boolean>(() => store.get("mirror", true));
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [task, setTask] = useState<Task | null>(null);
  const [names, setNames] = useState<Record<number, string>>({});
  const [stats, setStats] = useState<Stats | null>(null);
  const [last, setLast] = useState<InferResult | null>(null);
  const [unique, setUnique] = useState<Record<string, number>>({});
  const [compare, setCompare] = useState<Record<string, { fps: number; ms: number; frames: number }>>({});
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [targetDs, setTargetDs] = useState<number>(() => store.get("targetDs", 0));
  const [autoLabel, setAutoLabel] = useState(true);
  const [burst, setBurst] = useState(0);
  const [shots, setShots] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const captureRef = useRef(document.createElement("canvas"));
  const serverRef = useRef<ServerEngine | null>(null);
  const browserRef = useRef<BrowserEngine | null>(null);
  const resultRef = useRef<InferResult | null>(null);
  const runningRef = useRef(false);
  const dirtyRef = useRef(true);
  const trailsRef = useRef<Trails>(new Map());
  const uniqueRef = useRef<Map<string, Set<number>>>(new Map());
  const statsRef = useRef({ frames: 0, sum: 0, fps: 0, lastT: 0, lastServer: 0, lastRtt: 0, speed: {} as Record<string, number> });
  const sessionRef = useRef<number | null>(null);
  const loopIdRef = useRef(0);
  const drawRef = useRef(draw);
  const mirrorRef = useRef(mirror);
  const deviceRef = useRef(deviceId);
  deviceRef.current = deviceId;
  const sourceRef = useRef(source);
  drawRef.current = draw;
  mirrorRef.current = mirror;
  sourceRef.current = source;

  const onnxModel = onnx.find((m) => m.path === browserModel) ?? null;
  const currentModelName = engineKind === "server" ? cfg.model : (onnxModel?.path ?? "—");
  const modelInfo = models.find((m) => m.id === cfg.model);
  const promptable = /world|yoloe(?!.*-pf)/i.test(cfg.model);

  useEffect(() => store.set("cfg", { ...cfg, prompts: null, classes: null }), [cfg]);
  useEffect(() => store.set("draw", draw), [draw]);
  useEffect(() => store.set("mirror", mirror), [mirror]);
  useEffect(() => store.set("engine", engineKind), [engineKind]);
  useEffect(() => store.set("browserModel", browserModel), [browserModel]);
  useEffect(() => store.set("prompts", promptsText), [promptsText]);
  useEffect(() => store.set("targetDs", targetDs), [targetDs]);
  useEffect(() => store.set("camera", deviceId), [deviceId]);

  // A model picked on another page ("open in camera")
  useEffect(() => {
    if (!liveModel) return;
    if (liveModel.id.endsWith(".onnx")) {
      setEngineKind("browser");
      setBrowserModel(liveModel.id);
    } else {
      setEngineKind("server");
      setCfg((c) => ({ ...c, model: liveModel.id, classes: null }));
    }
  }, [liveModel]);

  useEffect(() => {
    get<Dataset[]>("/api/datasets").then(setDatasets).catch(() => setDatasets([]));
  }, []);

  const resetTracks = () => {
    trailsRef.current.clear();
    uniqueRef.current.clear();
    setUnique({});
  };

  // ---- engine configuration ----
  useEffect(() => {
    if (engineKind !== "server") return;
    serverRef.current ??= new ServerEngine();
    const t = setTimeout(async () => {
      const prompts = promptable ? promptsText.split(",").map((s) => s.trim()).filter(Boolean) : null;
      setStatus(`загрузка ${cfg.model}…`);
      try {
        const r = await serverRef.current!.configure({ ...cfg, prompts });
        setTask(r.task);
        setNames(r.names);
        setError("");
        setStatus(
          `${r.model} · ${TASK_LABEL[r.task] ?? r.task}` +
            (r.load_ms ? ` · загрузка ${r.load_ms} мс` : "") +
            (r.prompts_ms ? ` · словарь ${r.prompts_ms} мс` : ""),
        );
        dirtyRef.current = true;
      } catch (e) {
        setError((e as Error).message);
        setStatus("");
      }
    }, 250);
    return () => clearTimeout(t);
  }, [engineKind, cfg, promptsText, promptable]);

  useEffect(() => {
    resetTracks();
  }, [cfg.model, cfg.track, cfg.tracker, engineKind]);

  useEffect(() => {
    if (engineKind !== "browser") return;
    if (!onnxModel) {
      setStatus("");
      setError(onnx.length ? "выберите ONNX-модель" : "нет ONNX-моделей: экспортируйте модель на вкладке «Модели»");
      return;
    }
    browserRef.current ??= new BrowserEngine();
    let cancelled = false;
    setStatus(`загрузка ${onnxModel.path} в браузер…`);
    browserRef.current
      .load(onnxModel)
      .then((r) => {
        if (cancelled) return;
        setTask(onnxModel.task);
        setNames(onnxModel.names);
        setError("");
        setStatus(`${onnxModel.path} · ${r.backend} · загрузка ${r.load_ms} мс`);
        dirtyRef.current = true;
      })
      .catch((e) => !cancelled && setError(`ONNX: ${(e as Error).message}`));
    return () => {
      cancelled = true;
    };
  }, [engineKind, onnxModel, onnx.length]);

  useEffect(() => {
    if (browserRef.current) {
      browserRef.current.cfg = { conf: cfg.conf, iou: cfg.iou, max_det: cfg.max_det, classes: cfg.classes, agnostic_nms: cfg.agnostic_nms };
      dirtyRef.current = true;
    }
  }, [cfg, engineKind]);

  useEffect(
    () => () => {
      serverRef.current?.close();
      browserRef.current?.close();
    },
    [],
  );

  // ---- sources ----
  const refreshDevices = useCallback(async () => {
    const all = await navigator.mediaDevices.enumerateDevices();
    setDevices(all.filter((d) => d.kind === "videoinput"));
  }, []);

  const stopStream = () => {
    const v = videoRef.current;
    const s = v?.srcObject as MediaStream | null;
    s?.getTracks().forEach((t) => t.stop());
    if (v) v.srcObject = null;
  };

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("камера доступна только на localhost или https");
    stopStream();
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        // "front" / "back" pick by facing mode (phones); anything else is a concrete device id
        ...(deviceId === "front" || deviceId === "back"
          ? { facingMode: { ideal: deviceId === "back" ? "environment" : "user" } }
          : { deviceId: deviceId ? { exact: deviceId } : undefined }),
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });
    const v = videoRef.current!;
    v.srcObject = stream;
    await v.play();
    await refreshDevices();
  }, [deviceId, refreshDevices]);

  useEffect(() => {
    if (source === "camera" && running) startCamera().catch((e) => setError(`камера: ${e.message}`));
  }, [deviceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const onFile = (file: File) => {
    stopStream();
    const url = URL.createObjectURL(file);
    if (file.type.startsWith("video/")) {
      setSource("video");
      imageRef.current = null;
      const v = videoRef.current!;
      v.src = url;
      v.loop = true;
      void v.play();
    } else {
      setSource("image");
      const img = new Image();
      img.onload = () => {
        imageRef.current = img;
        dirtyRef.current = true;
      };
      img.src = url;
    }
    resetTracks();
    if (!runningRef.current) void start(file.type.startsWith("video/") ? "video" : "image");
  };

  const sourceEl = (): { el: CanvasImageSource; w: number; h: number } | null => {
    if (sourceRef.current === "image") {
      const img = imageRef.current;
      return img ? { el: img, w: img.naturalWidth, h: img.naturalHeight } : null;
    }
    const v = videoRef.current;
    return v && v.readyState >= 2 && v.videoWidth ? { el: v, w: v.videoWidth, h: v.videoHeight } : null;
  };

  /** Copies the current frame (mirrored like the display) into a canvas with the given longest side. */
  const grab = (canvas: HTMLCanvasElement, maxSide: number) => {
    const s = sourceEl();
    if (!s) return false;
    const k = Math.min(1, maxSide / Math.max(s.w, s.h));
    canvas.width = Math.round(s.w * k);
    canvas.height = Math.round(s.h * k);
    const ctx = canvas.getContext("2d")!;
    ctx.save();
    if (mirrorRef.current && sourceRef.current === "camera" && deviceRef.current !== "back") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(s.el, 0, 0, canvas.width, canvas.height);
    ctx.restore();
    return true;
  };

  // ---- render loop: frame + latest overlay ----
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const c = canvasRef.current;
      const s = sourceEl();
      if (!c || !s) return;
      if (c.width !== s.w || c.height !== s.h) {
        c.width = s.w;
        c.height = s.h;
      }
      const ctx = c.getContext("2d")!;
      ctx.save();
      if (mirrorRef.current && sourceRef.current === "camera" && deviceRef.current !== "back") {
        ctx.translate(c.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(s.el, 0, 0, c.width, c.height);
      ctx.restore();
      if (resultRef.current) drawResult(ctx, resultRef.current, c.width, c.height, drawRef.current, trailsRef.current);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, []);

  // ---- inference loop ----
  const engineKindRef = useRef(engineKind);
  engineKindRef.current = engineKind;
  const imgszRef = useRef(cfg.imgsz);
  imgszRef.current = cfg.imgsz;

  const loop = async (id: number) => {
    let frame = 0;
    let lastVideoTime = -1;
    while (runningRef.current && loopIdRef.current === id) {
      const v = videoRef.current!;
      const still = sourceRef.current === "image" || (sourceRef.current === "video" && v.paused && v.currentTime === lastVideoTime);
      if (still && !dirtyRef.current) {
        await sleep(60);
        continue;
      }
      const isBrowser = engineKindRef.current === "browser";
      const engine = isBrowser ? browserRef.current : serverRef.current;
      if (!engine || (isBrowser && !browserRef.current?.model)) {
        await sleep(100);
        continue;
      }
      if (!grab(captureRef.current, Math.max(320, imgszRef.current))) {
        await sleep(50);
        continue;
      }
      dirtyRef.current = false;
      lastVideoTime = v.currentTime;
      try {
        const res = await engine.infer(captureRef.current);
        if (res.semantic || res.depth) {
          const img = new Image();
          img.src = (res.semantic ?? res.depth)!.png;
          await img.decode().catch(() => {});
          res.overlay = img;
        }
        frame++;
        updateTracks(res, trailsRef.current, uniqueRef.current, frame);
        resultRef.current = res;
        const st = statsRef.current;
        const now = performance.now();
        if (st.lastT) st.fps = st.fps ? st.fps * 0.85 + (1000 / (now - st.lastT)) * 0.15 : 1000 / (now - st.lastT);
        st.lastT = now;
        st.frames++;
        st.sum += res.rtt_ms ?? 0;
        st.lastRtt = res.rtt_ms ?? 0;
        st.lastServer = res.server_ms ?? 0;
        st.speed = res.speed;
        setError("");
      } catch (e) {
        setError((e as Error).message);
        await sleep(1000);
      }
    }
  };

  // UI-facing stats at 4 Hz, and session log to MySQL every 5 s
  useEffect(() => {
    if (!running) return;
    const ui = setInterval(() => {
      const st = statsRef.current;
      setStats({ fps: st.fps, rtt: st.lastRtt, server: st.lastServer, speed: st.speed, frames: st.frames, avg: st.frames ? st.sum / st.frames : 0 });
      setLast(resultRef.current);
      setUnique(Object.fromEntries([...uniqueRef.current].map(([k, v]) => [k, v.size])));
      if (st.frames > 3)
        setCompare((c) => ({
          ...c,
          [`${engineKindRef.current === "browser" ? `браузер (${browserRef.current?.backend})` : "сервер (python)"} · ${currentModelName}`]: {
            fps: st.fps,
            ms: st.sum / st.frames,
            frames: st.frames,
          },
        }));
    }, 250);
    const log = setInterval(() => void saveSession(), 5000);
    return () => {
      clearInterval(ui);
      clearInterval(log);
    };
  }, [running, currentModelName]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveSession = async () => {
    const id = sessionRef.current;
    const st = statsRef.current;
    if (!id || !st.frames) return;
    const counts: Record<string, number> = {};
    for (const d of resultRef.current?.detections ?? []) counts[d.name] = (counts[d.name] ?? 0) + 1;
    await patch(`/api/sessions/${id}`, {
      frames: st.frames,
      avg_ms: st.sum / st.frames,
      fps: st.fps,
      counts,
      unique_tracks: Object.fromEntries([...uniqueRef.current].map(([k, v]) => [k, v.size])),
      task,
    }).catch(() => {});
  };

  const resetStats = () => {
    statsRef.current = { frames: 0, sum: 0, fps: 0, lastT: 0, lastServer: 0, lastRtt: 0, speed: {} };
  };

  // new session row whenever engine/model changes while running
  useEffect(() => {
    if (!running) return;
    resetStats();
    post<{ id: number }>("/api/sessions", { engine: engineKind, model: currentModelName, task, source })
      .then((r) => (sessionRef.current = r.id))
      .catch(() => (sessionRef.current = null));
    return () => void saveSession();
  }, [running, engineKind, currentModelName]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async (src: Source = source) => {
    setError("");
    try {
      if (src === "camera") {
        setSource("camera");
        imageRef.current = null;
        await startCamera();
      }
      runningRef.current = true;
      dirtyRef.current = true;
      setRunning(true);
      const id = ++loopIdRef.current;
      void loop(id);
    } catch (e) {
      setError(`камера: ${(e as Error).message}`);
    }
  };

  const stop = () => {
    runningRef.current = false;
    setRunning(false);
    stopStream();
    videoRef.current?.pause();
  };

  // ---- dataset capture ----
  const targetDataset = datasets.find((d) => d.id === targetDs);

  const snapshot = useCallback(async () => {
    const ds = datasets.find((d) => d.id === targetDs);
    if (!ds) return setError("выберите датасет для снимков");
    const canvas = document.createElement("canvas");
    if (!grab(canvas, 1920)) return;
    const res = resultRef.current;
    const anns = autoLabel && res ? toAnnotations(res, ds.task) : [];
    const form = new FormData();
    form.append("image", await canvasToBlob(canvas, "image/jpeg", 0.92), "frame.jpg");
    form.append("width", String(canvas.width));
    form.append("height", String(canvas.height));
    form.append("source", sourceRef.current);
    form.append("annotations", JSON.stringify(anns));
    try {
      const r = await postForm<{ classes: string[] }>(`/api/datasets/${ds.id}/images`, form);
      setShots((n) => n + 1);
      setDatasets((list) => list.map((d) => (d.id === ds.id ? { ...d, classes: r.classes, image_count: (d.image_count ?? 0) + 1 } : d)));
    } catch (e) {
      setError(`снимок: ${(e as Error).message}`);
    }
  }, [datasets, targetDs, autoLabel]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!burst || !running) return;
    const t = setInterval(() => void snapshot(), burst * 1000);
    return () => clearInterval(t);
  }, [burst, running, snapshot]);

  // ---- derived ----
  const counts = useMemo(() => {
    const m = new Map<string, { n: number; cls: number }>();
    for (const d of last?.detections ?? []) m.set(d.name, { n: (m.get(d.name)?.n ?? 0) + 1, cls: d.cls });
    return [...m].sort((a, b) => b[1].n - a[1].n);
  }, [last]);

  const serverModels = useMemo(() => {
    const groups = new Map<string, ModelInfo[]>();
    for (const m of models) {
      const key = m.kind === "custom" ? "Ваши обученные" : m.kind === "official" ? (TASK_LABEL[m.task] ?? m.task) : "Специальные";
      groups.set(key, [...(groups.get(key) ?? []), m]);
    }
    return [...groups];
  }, [models]);

  const nameList = Object.entries(names);
  const set = <K extends keyof ServerConfig>(k: K, v: ServerConfig[K]) => setCfg((c) => ({ ...c, [k]: v }));
  const toggleClass = (idx: number) =>
    setCfg((c) => {
      const cur = new Set(c.classes ?? []);
      if (cur.has(idx)) cur.delete(idx);
      else cur.add(idx);
      return { ...c, classes: cur.size ? [...cur] : null };
    });
  const trackable = task && ["detect", "segment", "pose", "obb"].includes(task);

  return (
    <div className="live">
      <section className="stage">
        <div className="toolbar">
          <div className="seg">
            <button className={engineKind === "server" ? "on" : ""} onClick={() => setEngineKind("server")} title="Ultralytics + PyTorch на Python-сервисе: все задачи, трекинг, ваши модели">
              Сервер (Python)
            </button>
            <button className={engineKind === "browser" ? "on" : ""} onClick={() => setEngineKind("browser")} title="ONNX Runtime Web прямо во вкладке (WebGPU или WASM)">
              Браузер (ONNX)
            </button>
          </div>
          {!running ? (
            <button className="primary" onClick={() => void start("camera")}>
              ▶ Камера
            </button>
          ) : (
            <button className="danger" onClick={stop}>
              ■ Стоп
            </button>
          )}
          <select value={deviceId} onChange={(e) => setDeviceId(e.target.value)} onFocus={() => void refreshDevices().catch(() => {})}>
            <option value="">Камера по умолчанию</option>
            <option value="front">Передняя (телефон)</option>
            <option value="back">Задняя (телефон)</option>
            {devices.map((d, i) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Камера ${i + 1}`}
              </option>
            ))}
          </select>
          <label className="file">
            Файл (фото / видео)
            <input type="file" accept="image/*,video/*" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </label>
          <label className="chk">
            <input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} /> зеркало
          </label>
        </div>
        <div className="canvas-wrap">
          <canvas ref={canvasRef} />
          {!running && !imageRef.current && <div className="placeholder">Нажмите «▶ Камера» или откройте фото / видео</div>}
          {/* not display:none: iOS Safari stops decoding frames of hidden videos */}
          <video ref={videoRef} playsInline muted autoPlay className="offscreen-video" />
        </div>
        <div className="statusline">
          {status && <span>{status}</span>}
          {error && <span className="err">{error}</span>}
        </div>
        {running && source === "video" && (
          <div className="row">
            <button onClick={() => (videoRef.current!.paused ? void videoRef.current!.play() : videoRef.current!.pause())}>⏯ Пауза / воспроизведение</button>
          </div>
        )}

        <div className="panel capture">
          <h3>Сбор данных для обучения</h3>
          <div className="row">
            <select value={targetDs} onChange={(e) => setTargetDs(Number(e.target.value))}>
              <option value={0}>— датасет —</option>
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({TASK_LABEL[d.task]}, {d.image_count ?? 0} фото)
                </option>
              ))}
            </select>
            <label className="chk" title="Сохранить вместе с найденными объектами как черновую разметку">
              <input type="checkbox" checked={autoLabel} onChange={(e) => setAutoLabel(e.target.checked)} /> авторазметка
            </label>
            <button className="primary" disabled={!running || !targetDataset} onClick={() => void snapshot()}>
              📸 Снимок в датасет
            </button>
            <select value={burst} onChange={(e) => setBurst(Number(e.target.value))} title="Автоматические снимки">
              <option value={0}>автосъёмка выкл.</option>
              <option value={1}>каждую 1 с</option>
              <option value={2}>каждые 2 с</option>
              <option value={5}>каждые 5 с</option>
            </select>
            {shots > 0 && <span className="muted">сохранено: {shots}</span>}
          </div>
          {!datasets.length && <p className="muted">Создайте датасет на вкладке «Датасеты» (нужен MySQL).</p>}
        </div>
      </section>

      <aside className="side">
        <div className="panel">
          <h3>Модель</h3>
          {engineKind === "server" ? (
            <>
              <select value={cfg.model} onChange={(e) => setCfg((c) => ({ ...c, model: e.target.value, classes: null }))}>
                {!models.some((m) => m.id === cfg.model) && <option value={cfg.model}>{cfg.model}</option>}
                {serverModels.map(([group, list]) => (
                  <optgroup key={group} label={group}>
                    {list.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title ?? m.id} {m.kind !== "official" && m.kind !== "custom" ? "" : `· ${TASK_LABEL[m.task] ?? m.task}`}
                        {m.downloaded ? "" : " ⇣"}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <p className="muted small">⇣ — скачается при первом выборе. {modelInfo?.title}</p>
              {promptable && (
                <label className="field">
                  Что искать (через запятую, по-английски)
                  <input value={promptsText} onChange={(e) => setPromptsText(e.target.value)} />
                </label>
              )}
            </>
          ) : (
            <>
              <select value={browserModel} onChange={(e) => setBrowserModel(e.target.value)}>
                <option value="">— ONNX-модель —</option>
                {onnx.map((m) => (
                  <option key={m.path} value={m.path} disabled={!BROWSER_TASKS.includes(m.task)}>
                    {m.path} · {TASK_LABEL[m.task]} · {m.imgsz[0]}px · {m.size_mb} МБ
                  </option>
                ))}
              </select>
              <p className="muted small">В браузере: детекция, позы, классификация. Экспорт ONNX — на вкладке «Модели».</p>
            </>
          )}
        </div>

        <div className="panel">
          <h3>Параметры</h3>
          <Slider label="Уверенность (conf)" value={cfg.conf} min={0.01} max={0.95} step={0.01} onChange={(v) => set("conf", v)} />
          <Slider label="Перекрытие NMS (iou)" value={cfg.iou} min={0.1} max={0.95} step={0.01} onChange={(v) => set("iou", v)} />
          <Slider label="Макс. объектов" value={cfg.max_det} min={1} max={300} step={1} onChange={(v) => set("max_det", v)} />
          {engineKind === "server" && (
            <>
              <label className="field">
                Размер входа (imgsz)
                <select value={cfg.imgsz} onChange={(e) => set("imgsz", Number(e.target.value))}>
                  {[256, 320, 416, 480, 640, 800, 960, 1280].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="chk">
                <input type="checkbox" checked={cfg.track} disabled={!trackable} onChange={(e) => set("track", e.target.checked)} /> Трекинг (ID объектов)
              </label>
              {cfg.track && (
                <select value={cfg.tracker} onChange={(e) => set("tracker", e.target.value as ServerConfig["tracker"])}>
                  <option value="bytetrack">ByteTrack</option>
                  <option value="botsort">BoT-SORT</option>
                </select>
              )}
              <label className="chk">
                <input type="checkbox" checked={cfg.augment} onChange={(e) => set("augment", e.target.checked)} /> TTA (augment, медленнее)
              </label>
            </>
          )}
          <label className="chk">
            <input type="checkbox" checked={cfg.agnostic_nms} onChange={(e) => set("agnostic_nms", e.target.checked)} /> NMS без учёта класса
          </label>
        </div>

        <div className="panel">
          <h3>Отображение</h3>
          <div className="chips">
            {(
              [
                ["boxes", "рамки"],
                ["labels", "подписи"],
                ["masks", "маски"],
                ["kpts", "скелет"],
                ["trails", "траектории"],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="chk">
                <input type="checkbox" checked={draw[k]} onChange={(e) => setDraw((d) => ({ ...d, [k]: e.target.checked }))} /> {label}
              </label>
            ))}
          </div>
          <Slider label="Прозрачность карт (семантика/глубина)" value={draw.dense} min={0} max={1} step={0.05} onChange={(v) => setDraw((d) => ({ ...d, dense: v }))} />
        </div>

        <div className="panel">
          <h3>Скорость</h3>
          {stats ? (
            <table className="kv">
              <tbody>
                <tr><td>FPS</td><td><b>{stats.fps.toFixed(1)}</b></td></tr>
                <tr><td>Кадр целиком</td><td>{stats.rtt} мс (в среднем {stats.avg.toFixed(0)})</td></tr>
                {engineKind === "server" && <tr><td>На сервере</td><td>{stats.server} мс</td></tr>}
                <tr><td>pre / infer / post</td><td>{["preprocess", "inference", "postprocess"].map((k) => stats.speed[k]?.toFixed(1) ?? "–").join(" / ")} мс</td></tr>
                <tr><td>Кадров</td><td>{stats.frames}</td></tr>
              </tbody>
            </table>
          ) : (
            <p className="muted">Запустите камеру.</p>
          )}
          {Object.keys(compare).length > 0 && (
            <>
              <h4>Сравнение движков</h4>
              <table className="grid small">
                <thead><tr><th>Движок · модель</th><th>FPS</th><th>мс</th></tr></thead>
                <tbody>
                  {Object.entries(compare).map(([k, v]) => (
                    <tr key={k}><td>{k}</td><td>{v.fps.toFixed(1)}</td><td>{v.ms.toFixed(0)}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        <div className="panel">
          <h3>Что видит модель</h3>
          {last?.top5 && (
            <div className="bars">
              {last.top5.map((p) => (
                <div key={p.cls} className="bar">
                  <span>{p.name}</span>
                  <i style={{ width: `${p.conf * 100}%` }} />
                  <b>{(p.conf * 100).toFixed(1)}%</b>
                </div>
              ))}
            </div>
          )}
          {last?.semantic && (
            <div className="bars">
              {last.semantic.classes.slice(0, 8).map((p) => (
                <div key={p.cls} className="bar">
                  <span>{p.name}</span>
                  <i style={{ width: `${p.share * 100}%` }} />
                  <b>{(p.share * 100).toFixed(1)}%</b>
                </div>
              ))}
            </div>
          )}
          {last?.depth && <p className="muted">Карта глубины: {last.depth.min} … {last.depth.max} (светлее — дальше)</p>}
          {counts.length > 0 && (
            <table className="grid small">
              <thead><tr><th>Класс</th><th>в кадре</th>{cfg.track && <th>уникальных</th>}</tr></thead>
              <tbody>
                {counts.map(([name, v]) => (
                  <tr key={name}>
                    <td><span className="dot" style={{ background: `hsl(${(v.cls * 47) % 360} 90% 55%)` }} />{name}</td>
                    <td>{v.n}</td>
                    {cfg.track && <td>{unique[name] ?? 0}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {last && !counts.length && !last.top5 && !last.semantic && !last.depth && <p className="muted">Ничего не найдено.</p>}
        </div>

        {nameList.length > 1 && nameList.length <= 200 && (
          <div className="panel">
            <h3>Фильтр классов {cfg.classes?.length ? `(${cfg.classes.length})` : "(все)"}</h3>
            <div className="chips scroll">
              {nameList.map(([idx, n]) => (
                <button key={idx} className={`chip ${cfg.classes?.includes(Number(idx)) ? "on" : ""}`} onClick={() => toggleClass(Number(idx))}>
                  {n}
                </button>
              ))}
            </div>
            {cfg.classes?.length ? <button onClick={() => set("classes", null)}>Сбросить</button> : null}
          </div>
        )}
      </aside>
    </div>
  );
}

function Slider(p: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <label className="field">
      <span className="between">
        {p.label} <b>{p.step < 1 ? p.value.toFixed(2) : p.value}</b>
      </span>
      <input type="range" min={p.min} max={p.max} step={p.step} value={p.value} onChange={(e) => p.onChange(Number(e.target.value))} />
    </label>
  );
}
