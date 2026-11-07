import { useCallback, useEffect, useState } from "react";
import { fileUrl, get, post, store } from "../api";
import { Chart } from "../components/Chart";
import { TASK_LABEL, type Dataset, type Job, type ModelInfo, type Run } from "../types";

const MODEL_TASK: Record<string, string> = { detect: "detect", segment: "segment", classify: "classify" };
const ACTIVE = ["queued", "running"];

export function Training({ models, onUse, onModelsChanged }: { models: ModelInfo[]; onUse: (id: string) => void; onModelsChanged: () => void }) {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [detail, setDetail] = useState<Run | null>(null);
  const [plots, setPlots] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState(() =>
    store.get("trainForm", { dataset: 0, model: "yolo26n.pt", epochs: 30, imgsz: 320, batch: 8, patience: 20 }),
  );
  const [valJob, setValJob] = useState<Job | null>(null);

  useEffect(() => store.set("trainForm", form), [form]);
  const loadRuns = useCallback(() => get<Run[]>("/api/runs").then(setRuns).catch((e) => setError(e.message)), []);
  useEffect(() => {
    get<Dataset[]>("/api/datasets").then(setDatasets).catch((e) => setError(e.message));
    void loadRuns();
  }, [loadRuns]);

  const anyActive = runs.some((r) => ACTIVE.includes(r.status));
  useEffect(() => {
    if (!anyActive) return;
    const t = setInterval(() => void loadRuns(), 3000);
    return () => clearInterval(t);
  }, [anyActive, loadRuns]);

  // selected run: poll while it is active
  useEffect(() => {
    if (sel === null) return setDetail(null);
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const r = await get<Run>(`/api/runs/${sel}`);
        if (stop) return;
        setDetail(r);
        const dir = r.job?.save_dir;
        if (dir) {
          const ls = await get<{ files: { name: string }[] }>(`/vision/ls/${dir}`).catch(() => ({ files: [] }));
          setPlots(ls.files.map((f) => f.name).filter((n) => /\.(png|jpg)$/i.test(n)).map((n) => `${dir}/${n}`));
        }
        if (ACTIVE.includes(r.status)) timer = setTimeout(tick, 2000);
        else onModelsChanged();
      } catch (e) {
        setError((e as Error).message);
      }
    };
    void tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [sel]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!valJob || !ACTIVE.includes(valJob.state)) return;
    const t = setTimeout(() => get<Job>(`/vision/jobs/${valJob.id}`).then(setValJob), 2000);
    return () => clearTimeout(t);
  }, [valJob]);

  const ds = datasets.find((d) => d.id === form.dataset);
  const baseModels = models.filter((m) => ds && m.task === MODEL_TASK[ds.task] && !["world", "yoloe", "fastsam", "oiv7"].includes(m.kind));

  const start = async () => {
    try {
      const r = await post<{ id: number; build: { counts: Record<string, number>; note: string | null } }>(`/api/datasets/${form.dataset}/train`, form);
      setError(r.build.note ? `Внимание: ${r.build.note}` : "");
      await loadRuns();
      setSel(r.id);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const job = detail?.job;
  const hist = job?.history ?? [];
  const metricKeys = Object.keys(hist.at(-1) ?? {});
  const pick = (re: RegExp) => metricKeys.filter((k) => re.test(k));

  return (
    <div className="training">
      <aside className="side left">
        <div className="panel">
          <h3>Новое обучение</h3>
          <label className="field">
            Датасет
            <select value={form.dataset} onChange={(e) => setForm({ ...form, dataset: Number(e.target.value) })}>
              <option value={0}>—</option>
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} · {TASK_LABEL[d.task]} · {d.image_count} фото
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Базовая модель (дообучение)
            <select value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })}>
              {!baseModels.some((m) => m.id === form.model) && <option value={form.model}>{form.model}</option>}
              {baseModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title ?? m.id}
                </option>
              ))}
            </select>
          </label>
          <div className="grid2">
            <label className="field">
              Эпохи
              <input type="number" min={1} value={form.epochs} onChange={(e) => setForm({ ...form, epochs: Number(e.target.value) })} />
            </label>
            <label className="field">
              imgsz
              <select value={form.imgsz} onChange={(e) => setForm({ ...form, imgsz: Number(e.target.value) })}>
                {[160, 224, 320, 416, 480, 640].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="field">
              batch
              <input type="number" min={1} value={form.batch} onChange={(e) => setForm({ ...form, batch: Number(e.target.value) })} />
            </label>
            <label className="field">
              patience
              <input type="number" min={1} value={form.patience} onChange={(e) => setForm({ ...form, patience: Number(e.target.value) })} />
            </label>
          </div>
          <p className="muted small">На CPU: начните с nano-модели, imgsz 320 и 20–50 эпох. Для классификации берите модель «-cls».</p>
          <button className="primary" disabled={!ds} onClick={() => void start()}>
            ▶ Обучить
          </button>
        </div>
        <div className="panel">
          <h3>Запуски</h3>
          {runs.map((r) => (
            <button key={r.id} className={`listitem ${r.id === sel ? "on" : ""}`} onClick={() => setSel(r.id)}>
              <b>
                #{r.id} {r.dataset_name ?? "—"} <span className={`state ${r.status}`}>{r.status}</span>
              </b>
              <span className="muted small">
                {r.base_model} · {r.epochs} эп. · {r.imgsz}px
                {r.metrics && Object.entries(r.metrics).find(([k]) => /mAP50\(|top1/.test(k))?.[1] != null
                  ? ` · ${Object.entries(r.metrics).find(([k]) => /mAP50\(|top1/.test(k))![0].replace("metrics/", "")} ${Object.entries(r.metrics)
                      .find(([k]) => /mAP50\(|top1/.test(k))![1]!
                      .toFixed(3)}`
                  : ""}
              </span>
            </button>
          ))}
          {!runs.length && <p className="muted">Ещё не обучали.</p>}
        </div>
      </aside>

      <section className="main">
        {error && <div className="err box">{error}</div>}
        {!detail ? (
          <div className="panel">
            <h3>Как обучить свою модель</h3>
            <ol>
              <li>«Датасеты» → создайте датасет и классы.</li>
              <li>«Камера» → выберите датасет и делайте снимки (с авторазметкой или без), или загрузите фото.</li>
              <li>Проверьте и поправьте рамки в редакторе.</li>
              <li>Здесь запустите обучение. Готовая модель появится в «Камере» в группе «Ваши обученные».</li>
            </ol>
          </div>
        ) : (
          <>
            <div className="panel">
              <div className="between">
                <h2>
                  Запуск #{detail.id} <span className={`state ${detail.status}`}>{detail.status}</span>
                </h2>
                <div className="row">
                  {ACTIVE.includes(detail.status) && (
                    <button className="danger" onClick={() => void post(`/api/runs/${detail.id}/cancel`).then(loadRuns)}>
                      Остановить
                    </button>
                  )}
                  {detail.best_model && (
                    <>
                      <button className="primary" onClick={() => onUse(detail.best_model!)}>
                        Открыть в камере
                      </button>
                      <button
                        disabled={!detail.dataset_id}
                        onClick={() =>
                          void post<{ job: Job }>(`/api/datasets/${detail.dataset_id}/val`, { model: detail.best_model, imgsz: detail.imgsz })
                            .then((r) => setValJob(r.job))
                            .catch((e) => setError(e.message))
                        }
                      >
                        Валидация
                      </button>
                      <button
                        onClick={() =>
                          void post("/vision/jobs", { kind: "export", params: { model: detail.best_model, format: "onnx", imgsz: detail.imgsz } })
                            .then(() => setError("Экспорт в ONNX запущен — смотрите вкладку «Модели»"))
                            .catch((e) => setError(e.message))
                        }
                      >
                        Экспорт ONNX (для браузера)
                      </button>
                      <a className="btn" href={fileUrl(detail.best_model, true)}>
                        Скачать best.pt
                      </a>
                    </>
                  )}
                </div>
              </div>
              <p className="muted">
                {detail.dataset_name} · база {detail.base_model} · imgsz {detail.imgsz} · batch {detail.batch}
              </p>
              {job && job.epochs ? (
                <>
                  <div className="progress">
                    <i style={{ width: `${(((job.epoch ?? 1) - 1 + (job.batches ? (job.batch_i ?? 0) / job.batches : 0)) / job.epochs) * 100}%` }} />
                  </div>
                  <p className="muted small">
                    эпоха {job.epoch} / {job.epochs}
                    {job.batches ? ` · батч ${job.batch_i}/${job.batches}` : ""}
                    {job.started ? ` · идёт ${Math.round(((job.finished ?? Date.now() / 1000) - job.started) / 60)} мин` : ""}
                  </p>
                </>
              ) : null}
              {detail.error && <pre className="err">{detail.error}</pre>}
              {valJob && (
                <div className="box">
                  <b>Валидация: {valJob.state}</b>
                  {valJob.result && (
                    <table className="kv small">
                      <tbody>
                        {Object.entries(valJob.result.metrics ?? {}).map(([k, v]) => (
                          <tr key={k}>
                            <td>{k}</td>
                            <td>{v == null ? "–" : (v as number).toFixed(4)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {valJob.error && <pre className="err">{valJob.error}</pre>}
                </div>
              )}
            </div>
            {hist.length > 0 && (
              <div className="charts">
                <Chart title="Качество" rows={hist} keys={pick(/mAP|precision|recall|accuracy/)} />
                <Chart title="Потери (train)" rows={hist} keys={pick(/^train\//)} />
                <Chart title="Потери (val)" rows={hist} keys={pick(/^val\//)} />
              </div>
            )}
            {plots.length > 0 && (
              <div className="plots">
                {plots.map((p) => (
                  <a key={p} href={fileUrl(p)} target="_blank" rel="noreferrer">
                    <img src={fileUrl(p)} alt={p} loading="lazy" />
                    <span className="small muted">{p.split("/").pop()}</span>
                  </a>
                ))}
              </div>
            )}
            {job?.log && (
              <details>
                <summary>Лог обучения</summary>
                <pre className="log">{job.log}</pre>
              </details>
            )}
          </>
        )}
      </section>
    </div>
  );
}
