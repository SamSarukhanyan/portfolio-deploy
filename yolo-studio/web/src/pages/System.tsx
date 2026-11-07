import { useEffect, useState } from "react";
import { get } from "../api";

interface Health {
  api: { ok: boolean; node: string };
  db: { ok: boolean; error: string | null };
  vision: Record<string, any>;
}

export function System() {
  const [h, setH] = useState<Health | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    get<Health>("/api/health").then(setH).catch((e) => setError(`API (Node, порт 4010): ${e.message}`));
    get<any[]>("/api/sessions").then(setSessions).catch(() => {});
  }, []);

  const ok = (b?: boolean) => <span className={`state ${b ? "done" : "failed"}`}>{b ? "работает" : "нет"}</span>;

  return (
    <div className="system main">
      {error && <div className="err box">{error}</div>}
      {h && (
        <div className="panel">
          <h3>Сервисы</h3>
          <table className="kv">
            <tbody>
              <tr><td>React (Vite) :5180</td><td>{ok(true)}</td></tr>
              <tr><td>Node API :4010</td><td>{ok(h.api.ok)} Node {h.api.node}</td></tr>
              <tr><td>MySQL (yolo_studio)</td><td>{ok(h.db.ok)} {h.db.error && <span className="err small">{h.db.error} — запустите <code>./scripts/setup-db.sh</code></span>}</td></tr>
              <tr><td>Python vision :8001</td><td>{ok(h.vision.ok)} {h.vision.error}</td></tr>
              {h.vision.ok && (
                <>
                  <tr><td>Ultralytics</td><td>{h.vision.ultralytics}</td></tr>
                  <tr><td>PyTorch</td><td>{h.vision.torch} · {h.vision.cuda ? "CUDA" : "CPU"} · {h.vision.threads} потоков из {h.vision.cpus}</td></tr>
                  <tr><td>Python</td><td>{h.vision.python}</td></tr>
                  <tr><td>Папка данных</td><td><code>{h.vision.data_dir}</code></td></tr>
                </>
              )}
              <tr><td>Браузер</td><td>WebGPU: {"gpu" in navigator ? "есть" : "нет"} · изоляция для WASM-потоков: {self.crossOriginIsolated ? "да" : "нет"}</td></tr>
            </tbody>
          </table>
        </div>
      )}
      <div className="panel">
        <h3>История сессий камеры (MySQL)</h3>
        <table className="grid small">
          <thead>
            <tr><th>#</th><th>Когда</th><th>Движок</th><th>Модель</th><th>Источник</th><th>Кадров</th><th>FPS</th><th>мс</th><th>Уникальных объектов</th></tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id}>
                <td>{s.id}</td>
                <td>{new Date(s.started_at).toLocaleString()}</td>
                <td>{s.engine}</td>
                <td>{s.model}</td>
                <td>{s.source}</td>
                <td>{s.frames}</td>
                <td>{s.fps?.toFixed(1)}</td>
                <td>{s.avg_ms?.toFixed(0)}</td>
                <td>{Object.entries(s.unique_tracks ?? {}).map(([k, v]) => `${k}: ${v}`).join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!sessions.length && <p className="muted">Пока нет записей.</p>}
      </div>
    </div>
  );
}
