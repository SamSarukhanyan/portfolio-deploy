import { useCallback, useEffect, useRef, useState } from "react";
import { canvasToBlob, del, get, patch, post, postForm, put, store } from "../api";
import { color } from "../draw";
import { TASK_LABEL, type Annotation, type Dataset, type ImageRow, type InferResult, type ModelInfo, type Pt, type Shape } from "../types";

const MODEL_TASK: Record<Dataset["task"], string[]> = { detect: ["detect", "obb"], segment: ["segment"], classify: ["classify"] };

export function Datasets({ models }: { models: ModelInfo[] }) {
  const [list, setList] = useState<Dataset[]>([]);
  const [error, setError] = useState("");
  const [sel, setSel] = useState<number>(() => store.get("dataset", 0));
  const [ds, setDs] = useState<(Dataset & { images: ImageRow[] }) | null>(null);
  const [form, setForm] = useState({ name: "", task: "detect" as Dataset["task"], classes: "" });
  const [newClass, setNewClass] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [labelModel, setLabelModel] = useState("");
  const [upload, setUpload] = useState<{ done: number; total: number } | null>(null);
  const [filter, setFilter] = useState<"all" | "unlabelled" | "train" | "val">("all");

  const loadList = useCallback(() => get<Dataset[]>("/api/datasets").then(setList).catch((e) => setError(e.message)), []);
  const loadDs = useCallback(async () => {
    if (!sel) return setDs(null);
    try {
      setDs(await get(`/api/datasets/${sel}`));
    } catch (e) {
      setError((e as Error).message);
      setDs(null);
    }
  }, [sel]);

  useEffect(() => void loadList(), [loadList]);
  useEffect(() => {
    store.set("dataset", sel);
    void loadDs();
  }, [sel, loadDs]);

  const create = async () => {
    try {
      const d = await post<Dataset>("/api/datasets", {
        name: form.name,
        task: form.task,
        classes: form.classes.split(",").map((s) => s.trim()).filter(Boolean),
      });
      setForm({ name: "", task: "detect", classes: "" });
      await loadList();
      setSel(d.id);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      setError("");
      await loadDs();
      void loadList();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const labellers = models.filter((m) => ds && MODEL_TASK[ds.task].includes(m.task));

  const uploadFiles = async (files: FileList) => {
    if (!ds) return;
    setUpload({ done: 0, total: files.length });
    for (const file of Array.from(files)) {
      try {
        const img = await loadImage(URL.createObjectURL(file));
        const k = Math.min(1, 1920 / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * k);
        c.height = Math.round(img.naturalHeight * k);
        c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
        const blob = await canvasToBlob(c, "image/jpeg", 0.92);
        let anns: unknown[] = [];
        if (labelModel) {
          const f = new FormData();
          f.append("file", blob, "img.jpg");
          f.append("config", JSON.stringify({ model: labelModel, conf: 0.35 }));
          const res = await postForm<InferResult>("/vision/predict", f);
          anns = toAnnotations(res, ds.task);
        }
        const form = new FormData();
        form.append("image", blob, file.name.replace(/\.\w+$/, ".jpg"));
        form.append("width", String(c.width));
        form.append("height", String(c.height));
        form.append("source", labelModel ? `auto:${labelModel}`.slice(0, 40) : "upload");
        form.append("annotations", JSON.stringify(anns));
        await postForm(`/api/datasets/${ds.id}/images`, form);
      } catch (e) {
        setError(`${file.name}: ${(e as Error).message}`);
      }
      setUpload((u) => u && { ...u, done: u.done + 1 });
    }
    setUpload(null);
    await loadDs();
    void loadList();
  };

  const images = (ds?.images ?? []).filter((i) =>
    filter === "all" ? true : filter === "unlabelled" ? !i.annotations.length : i.split === filter,
  );
  const editIdx = editing === null ? -1 : images.findIndex((i) => i.id === editing);

  return (
    <div className="datasets">
      <aside className="side left">
        <div className="panel">
          <h3>Новый датасет</h3>
          <input placeholder="Название" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select value={form.task} onChange={(e) => setForm({ ...form, task: e.target.value as Dataset["task"] })}>
            <option value="detect">Детекция (рамки)</option>
            <option value="segment">Сегментация (контуры)</option>
            <option value="classify">Классификация (вся картинка)</option>
          </select>
          <input placeholder="Классы через запятую (можно позже)" value={form.classes} onChange={(e) => setForm({ ...form, classes: e.target.value })} />
          <button className="primary" disabled={!form.name.trim()} onClick={() => void create()}>
            Создать
          </button>
        </div>
        <div className="panel">
          <h3>Датасеты</h3>
          {list.map((d) => (
            <button key={d.id} className={`listitem ${d.id === sel ? "on" : ""}`} onClick={() => setSel(d.id)}>
              <b>{d.name}</b>
              <span className="muted small">
                {TASK_LABEL[d.task]} · {d.image_count} фото · {d.label_count} меток · {d.classes.length} классов
              </span>
            </button>
          ))}
          {!list.length && <p className="muted">Пока пусто.</p>}
        </div>
      </aside>

      <section className="main">
        {error && <div className="err box">{error}</div>}
        {!ds ? (
          <p className="muted">Выберите или создайте датасет. Снимки можно добавлять прямо с камеры на вкладке «Камера».</p>
        ) : (
          <>
            <div className="panel">
              <div className="between">
                <h2>
                  {ds.name} <span className="muted small">{TASK_LABEL[ds.task]}</span>
                </h2>
                <button
                  className="danger"
                  onClick={() => confirm(`Удалить датасет «${ds.name}» со всеми фото?`) && void run(async () => (await del(`/api/datasets/${ds.id}`), setSel(0)))}
                >
                  Удалить датасет
                </button>
              </div>
              <h4>Классы</h4>
              <div className="chips">
                {ds.classes.map((c, i) => (
                  <span key={i} className="chip static" style={{ borderColor: color(i) }}>
                    <span className="dot" style={{ background: color(i) }} />
                    {i}: {c}
                    <button
                      title="Переименовать"
                      onClick={() => {
                        const n = prompt("Новое имя класса", c)?.trim();
                        if (n && n !== c) void run(() => patch(`/api/datasets/${ds.id}`, { classes: ds.classes.map((x, j) => (j === i ? n : x)) }));
                      }}
                    >
                      ✎
                    </button>
                    <button
                      title="Удалить класс и его метки"
                      onClick={() => confirm(`Удалить класс «${c}» и все его метки?`) && void run(() => del(`/api/datasets/${ds.id}/classes/${i}`))}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  className="inline"
                  placeholder="+ класс"
                  value={newClass}
                  onChange={(e) => setNewClass(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newClass.trim()) {
                      void run(() => patch(`/api/datasets/${ds.id}`, { classes: [...ds.classes, newClass.trim()] }));
                      setNewClass("");
                    }
                  }}
                />
              </div>
              <h4>Добавить фото</h4>
              <div className="row">
                <select value={labelModel} onChange={(e) => setLabelModel(e.target.value)}>
                  <option value="">без авторазметки</option>
                  {labellers.map((m) => (
                    <option key={m.id} value={m.id}>
                      авторазметка: {m.title ?? m.id}
                    </option>
                  ))}
                </select>
                <label className="file primary">
                  Загрузить фото…
                  <input type="file" accept="image/*" multiple onChange={(e) => e.target.files?.length && void uploadFiles(e.target.files)} />
                </label>
                {upload && (
                  <span>
                    {upload.done} / {upload.total}
                  </span>
                )}
              </div>
            </div>

            <div className="row">
              {(["all", "unlabelled", "train", "val"] as const).map((f) => (
                <button key={f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>
                  {{ all: "Все", unlabelled: "Без разметки", train: "train", val: "val" }[f]}
                </button>
              ))}
              <span className="muted">{images.length} фото</span>
            </div>
            <div className="thumbs">
              {images.map((img) => (
                <button key={img.id} className="thumb" onClick={() => setEditing(img.id)}>
                  <ImageWithShapes img={img} />
                  <span className="tag">
                    {img.split} · {ds.task === "classify" ? (ds.classes[img.annotations[0]?.class_idx] ?? "—") : img.annotations.length}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      {ds && editIdx >= 0 && (
        <Editor
          key={images[editIdx].id}
          ds={ds}
          img={images[editIdx]}
          onClose={() => setEditing(null)}
          onNav={(d) => {
            const next = images[editIdx + d];
            if (next) setEditing(next.id);
          }}
          onSaved={loadDs}
          onDelete={async () => {
            const next = images[editIdx + 1] ?? images[editIdx - 1];
            await del(`/api/images/${images[editIdx].id}`);
            setEditing(next?.id ?? null);
            await loadDs();
            void loadList();
          }}
        />
      )}
    </div>
  );
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("не удалось открыть изображение"));
    i.src = src;
  });
}

export function toAnnotations(res: InferResult, task: Dataset["task"]) {
  if (task === "classify") return res.top5?.[0] ? [{ name: res.top5[0].name }] : [];
  return res.detections.map((d) => {
    const poly = d.poly && d.poly.length >= 3 ? d.poly : d.obb;
    if (task === "segment" && poly) return { name: d.name, shape: { type: "poly", points: poly.map(([x, y]) => [x / res.w, y / res.h]) } };
    const [x1, y1, x2, y2] = d.box;
    return { name: d.name, shape: { type: "box", cx: (x1 + x2) / 2 / res.w, cy: (y1 + y2) / 2 / res.h, w: (x2 - x1) / res.w, h: (y2 - y1) / res.h } };
  });
}

function ShapeSvg({ a, w, h, selected, onClick }: { a: Annotation; w: number; h: number; selected?: boolean; onClick?: (e: React.MouseEvent) => void }) {
  if (!a.shape) return null;
  const c = color(a.class_idx);
  const common = {
    fill: color(a.class_idx, selected ? 0.35 : 0.15),
    stroke: c,
    strokeWidth: Math.max(2, w / 300) * (selected ? 2 : 1),
    onMouseDown: onClick,
    style: { cursor: onClick ? "pointer" : undefined },
  };
  if (a.shape.type === "box") {
    const s = a.shape;
    return <rect x={(s.cx - s.w / 2) * w} y={(s.cy - s.h / 2) * h} width={s.w * w} height={s.h * h} {...common} />;
  }
  return <polygon points={a.shape.points.map(([x, y]) => `${x * w},${y * h}`).join(" ")} {...common} />;
}

function ImageWithShapes({ img }: { img: ImageRow }) {
  return (
    <div className="imgshapes">
      <img src={`/api/images/${img.id}/file`} loading="lazy" alt="" />
      <svg viewBox={`0 0 ${img.width} ${img.height}`} preserveAspectRatio="none">
        {img.annotations.map((a, i) => (
          <ShapeSvg key={i} a={a} w={img.width} h={img.height} />
        ))}
      </svg>
    </div>
  );
}

function Editor(props: {
  ds: Dataset;
  img: ImageRow;
  onClose: () => void;
  onNav: (d: number) => void;
  onSaved: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const { ds, img } = props;
  const [anns, setAnns] = useState<Annotation[]>(img.annotations.map((a) => ({ class_idx: a.class_idx, shape: a.shape })));
  const [split, setSplit] = useState(img.split);
  const [cls, setCls] = useState<number>(() => store.get("editorClass", 0));
  const [selected, setSelected] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ a: Pt; b: Pt } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState("");
  const svgRef = useRef<SVGSVGElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [frame, setFrame] = useState<React.CSSProperties>({ display: "none" });
  const W = img.width;
  const H = img.height;

  useEffect(() => store.set("editorClass", cls), [cls]);

  // keep the drawing layer exactly on top of the letterboxed image
  useEffect(() => {
    const el = imgRef.current!;
    const fit = () => setFrame({ left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight });
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    el.addEventListener("load", fit);
    return () => {
      ro.disconnect();
      el.removeEventListener("load", fit);
    };
  }, []);

  const change = (next: Annotation[]) => {
    setAnns(next);
    setDirty(true);
  };

  const save = useCallback(async () => {
    try {
      await put(`/api/images/${img.id}`, { split, annotations: anns });
      setDirty(false);
      setMsg("сохранено");
      await props.onSaved();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }, [img.id, split, anns, props]);

  const pt = (e: { clientX: number; clientY: number }): Pt => {
    const p = svgRef.current!.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    const q = p.matrixTransform(svgRef.current!.getScreenCTM()!.inverse());
    return [Math.min(W, Math.max(0, q.x)), Math.min(H, Math.max(0, q.y))];
  };

  // Track the drag on the window so releasing outside the image still finishes the box.
  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    const move = (e: MouseEvent) => setDrag((d) => d && { ...d, b: pt(e) });
    const up = (e: MouseEvent) => {
      const a = drag!.a;
      const b = pt(e);
      setDrag(null);
      const [x1, x2] = [Math.min(a[0], b[0]), Math.max(a[0], b[0])];
      const [y1, y2] = [Math.min(a[1], b[1]), Math.max(a[1], b[1])];
      if (x2 - x1 < 4 || y2 - y1 < 4 || !ds.classes.length) return;
      const shape: Shape = { type: "box", cx: (x1 + x2) / 2 / W, cy: (y1 + y2) / 2 / H, w: (x2 - x1) / W, h: (y2 - y1) / H };
      change([...anns, { class_idx: cls, shape }]);
      setSelected(anns.length);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [dragging]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "SELECT") return;
      if ((e.key === "Delete" || e.key === "Backspace") && selected !== null) {
        change(anns.filter((_, i) => i !== selected));
        setSelected(null);
      } else if (e.key === "ArrowRight" || e.key === "d") props.onNav(1);
      else if (e.key === "ArrowLeft" || e.key === "a") props.onNav(-1);
      else if (e.key === "Escape") props.onClose();
      else if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        void save();
      } else if (/^[1-9]$/.test(e.key) && Number(e.key) <= ds.classes.length) {
        const c = Number(e.key) - 1;
        setCls(c);
        if (selected !== null) change(anns.map((a, i) => (i === selected ? { ...a, class_idx: c } : a)));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const classify = ds.task === "classify";

  return (
    <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && props.onClose()}>
      <div className="editor">
        <div className="editor-canvas">
          <img ref={imgRef} src={`/api/images/${img.id}/file`} alt="" draggable={false} />
          <svg
            ref={svgRef}
            style={frame}
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            onMouseDown={(e) => {
              if (classify || e.target !== svgRef.current) return;
              setSelected(null);
              const p = pt(e);
              setDrag({ a: p, b: p });
            }}
          >
            {anns.map((a, i) => (
              <ShapeSvg
                key={i}
                a={a}
                w={W}
                h={H}
                selected={i === selected}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelected(i);
                }}
              />
            ))}
            {drag && (
              <rect
                x={Math.min(drag.a[0], drag.b[0])}
                y={Math.min(drag.a[1], drag.b[1])}
                width={Math.abs(drag.b[0] - drag.a[0])}
                height={Math.abs(drag.b[1] - drag.a[1])}
                fill="none"
                stroke={color(cls)}
                strokeWidth={Math.max(2, W / 300)}
                strokeDasharray="8 6"
              />
            )}
          </svg>
        </div>
        <div className="editor-side">
          <div className="between">
            <b>Фото #{img.id}</b>
            <button onClick={props.onClose}>✕</button>
          </div>
          <p className="muted small">
            {W}×{H} · источник: {img.source}
          </p>
          <label className="field">
            Выборка
            <select
              value={split}
              onChange={(e) => {
                setSplit(e.target.value as ImageRow["split"]);
                setDirty(true);
              }}
            >
              <option value="train">train (обучение)</option>
              <option value="val">val (проверка)</option>
            </select>
          </label>
          <h4>{classify ? "Класс изображения" : "Класс для новых рамок"}</h4>
          {!ds.classes.length && <p className="err">Сначала добавьте классы.</p>}
          <div className="classlist">
            {ds.classes.map((c, i) => {
              const on = classify ? anns[0]?.class_idx === i : cls === i;
              return (
                <button
                  key={i}
                  className={`chip ${on ? "on" : ""}`}
                  onClick={() => {
                    setCls(i);
                    if (classify) change([{ class_idx: i, shape: null }]);
                    else if (selected !== null) change(anns.map((a, j) => (j === selected ? { ...a, class_idx: i } : a)));
                  }}
                >
                  <span className="dot" style={{ background: color(i) }} />
                  {i < 9 ? `${i + 1}. ` : ""}
                  {c}
                </button>
              );
            })}
          </div>
          {!classify && (
            <>
              <h4>Объекты ({anns.length})</h4>
              <div className="annlist">
                {anns.map((a, i) => (
                  <div key={i} className={`ann ${i === selected ? "on" : ""}`} onClick={() => setSelected(i)}>
                    <span className="dot" style={{ background: color(a.class_idx) }} />
                    {ds.classes[a.class_idx] ?? `?${a.class_idx}`} <span className="muted small">{a.shape?.type === "poly" ? "контур" : "рамка"}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        change(anns.filter((_, j) => j !== i));
                        setSelected(null);
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <p className="muted small">Тяните мышью по фото — новая рамка. Клик — выбрать, Delete — удалить, 1–9 — класс.</p>
            </>
          )}
          <div className="row">
            <button className="primary" disabled={!dirty} onClick={() => void save()}>
              Сохранить (Ctrl+S)
            </button>
            {classify && anns.length > 0 && <button onClick={() => change([])}>Снять метку</button>}
          </div>
          <div className="row">
            <button onClick={() => props.onNav(-1)}>← Пред.</button>
            <button onClick={() => props.onNav(1)}>След. →</button>
            <button className="danger" onClick={() => confirm("Удалить фото?") && void props.onDelete()}>
              Удалить
            </button>
          </div>
          {dirty && <p className="muted small">Есть несохранённые изменения.</p>}
          {msg && <p className="muted small">{msg}</p>}
        </div>
      </div>
    </div>
  );
}
