import { useCallback, useEffect, useMemo, useState } from "react";
import { fileUrl, get, post } from "../api";
import { BROWSER_TASKS } from "../engines/browser";
import { TASK_LABEL, type Job, type ModelInfo, type OnnxModel } from "../types";

const FORMATS = [
  ["onnx", "ONNX — браузер, ONNX Runtime"],
  ["torchscript", "TorchScript"],
  ["openvino", "OpenVINO — быстрый CPU Intel"],
  ["ncnn", "NCNN — телефоны, Raspberry Pi"],
] as const;

export function Models(props: { models: ModelInfo[]; onnx: OnnxModel[]; reload: () => void; onUse: (id: string) => void }) {
  const { models, onnx, reload, onUse } = props;
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState("");
  const [taskFilter, setTaskFilter] = useState("detect");
  const [exp, setExp] = useState({ format: "onnx", imgsz: 640 });

  const loadJobs = useCallback(
    () =>
      get<{ jobs: Job[] }>("/vision/jobs")
        .then((r) => setJobs(r.jobs.filter((j) => j.kind !== "train")))
        .catch((e) => setError(e.message)),
    [],
  );
  useEffect(() => void loadJobs(), [loadJobs]);

  const active = jobs.some((j) => j.state === "running" || j.state === "queued");
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => void loadJobs(), 2000);
    return () => clearInterval(t);
  }, [active, loadJobs]);
  const doneCount = jobs.filter((j) => j.state === "done").length;
  useEffect(() => reload(), [doneCount]); // eslint-disable-line react-hooks/exhaustive-deps

  const job = async (kind: Job["kind"], params: Record<string, unknown>) => {
    try {
      await post("/vision/jobs", { kind, params });
      setError("");
      await loadJobs();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const tasks = useMemo(() => [...new Set(models.map((m) => m.task))], [models]);
  const shown = models.filter((m) => m.task === taskFilter);

  return (
    <div className="models">
      <section className="main">
        {error && <div className="err box">{error}</div>}
        <div className="panel">
          <div className="between">
            <h3>Каталог моделей Ultralytics</h3>
            <div className="row">
              Экспорт в
              <select value={exp.format} onChange={(e) => setExp({ ...exp, format: e.target.value })}>
                {FORMATS.map(([f, label]) => (
                  <option key={f} value={f}>
                    {label}
                  </option>
                ))}
              </select>
              imgsz
              <select value={exp.imgsz} onChange={(e) => setExp({ ...exp, imgsz: Number(e.target.value) })}>
                {[224, 320, 416, 640].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="row">
            {tasks.map((t) => (
              <button key={t} className={t === taskFilter ? "on" : ""} onClick={() => setTaskFilter(t)}>
                {TASK_LABEL[t] ?? t} ({models.filter((m) => m.task === t).length})
              </button>
            ))}
          </div>
          <table className="grid">
            <thead>
              <tr>
                <th>Модель</th>
                <th>Семейство</th>
                <th>Файл</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((m) => (
                <tr key={m.id}>
                  <td>
                    <b>{m.id.split("/").pop()}</b>
                    {m.title && <div className="muted small">{m.title}</div>}
                  </td>
                  <td>
                    {m.family}
                    {m.size ? ` · ${m.size}` : ""}
                  </td>
                  <td>{m.downloaded ? "✓ скачана" : <span className="muted">нет</span>}</td>
                  <td className="row">
                    {!m.downloaded && <button onClick={() => void job("download", { model: m.id })}>Скачать</button>}
                    <button className="primary" onClick={() => onUse(m.id)}>
                      В камеру
                    </button>
                    <button onClick={() => void job("export", { model: m.id, format: exp.format, imgsz: exp.imgsz })}>Экспорт</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <aside className="side">
        <div className="panel">
          <h3>ONNX для браузера</h3>
          {onnx.map((m) => (
            <div key={m.path} className="listitem static">
              <b>{m.path}</b>
              <span className="muted small">
                {TASK_LABEL[m.task]} · {m.imgsz[0]}px · {Object.keys(m.names).length} классов · {m.size_mb} МБ
              </span>
              <div className="row">
                <button className="primary" disabled={!BROWSER_TASKS.includes(m.task)} onClick={() => onUse(m.path)}>
                  Запустить в браузере
                </button>
                <a className="btn" href={fileUrl(m.path, true)}>
                  Скачать
                </a>
              </div>
            </div>
          ))}
          {!onnx.length && <p className="muted">Нажмите «Экспорт» с форматом ONNX у модели детекции, поз или классификации.</p>}
        </div>
        <div className="panel">
          <h3>Задачи</h3>
          {jobs.map((j) => (
            <div key={j.id} className="listitem static">
              <b>
                {{ download: "Скачивание", export: "Экспорт", val: "Валидация", train: "Обучение" }[j.kind]} <span className={`state ${j.state}`}>{j.state}</span>
              </b>
              <span className="muted small">
                {j.params.model} {j.params.format ? `→ ${j.params.format} ${j.params.imgsz}px` : ""}
              </span>
              {j.error && <span className="err small">{j.error}</span>}
              {j.result?.path &&
                (j.result.is_dir ? (
                  <span className="small">папка: data/{j.result.path}</span>
                ) : (
                  <a className="small" href={fileUrl(j.result.path, true)}>
                    ⇣ {j.result.path}
                  </a>
                ))}
              {j.kind === "val" && j.result?.metrics && (
                <span className="small muted">
                  {Object.entries(j.result.metrics as Record<string, number | null>)
                    .filter(([k]) => /mAP50|top1/.test(k))
                    .map(([k, v]) => `${k.replace("metrics/", "")} ${v?.toFixed(3)}`)
                    .join(" · ")}
                </span>
              )}
            </div>
          ))}
          {!jobs.length && <p className="muted">Пусто.</p>}
        </div>
      </aside>
    </div>
  );
}
