import { useEffect, useRef, useState } from "react";
import type { IncidentSummary, ScenarioSummary } from "../../../contracts/api";
import type { Metrics } from "../../../contracts/events";
import { STAGES, STATUS_TEXT, stageIndex, type FeedItem, type IncidentView } from "./incident";
import { useLab, useReplay } from "./useLab";
import styles from "./LabPage.module.css";

const LAB_SITE = "https://lab.samsarukhanyan.com";

export function LabPage() {
  const lab = useLab();
  const [replayId, setReplayId] = useState<string | null>(null);
  const [replayNonce, setReplayNonce] = useState(0); // clicking Replay again restarts it
  const replay = useReplay(replayId, replayNonce);
  const [notice, setNotice] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const liveRunning = lab.live !== null && !lab.live.outcome;
  const busy = liveRunning || (lab.status !== null && lab.status.status !== "idle");
  // A live incident always wins over a replay.
  const shown: IncidentView | null = liveRunning ? lab.live : replayId ? replay.view : lab.live;
  const isReplay = !liveRunning && replayId !== null;

  useEffect(() => {
    if (liveRunning) setReplayId(null);
  }, [liveRunning]);

  async function onBreak(id: string) {
    setSending(true);
    setNotice(null);
    const r = await lab.breakIt(id);
    setSending(false);
    if (!r.ok) setNotice(r.message);
    else document.getElementById("lab-console")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section className={`section ${styles.page}`}>
      <div className="shell">
        <header className={styles.intro}>
          <p className={styles.eyebrow}>
            <span className={`${styles.liveDot} ${lab.online ? styles.liveDotOn : ""}`} aria-hidden />
            Incident Lab · {lab.online === null ? "connecting" : lab.online ? "live" : "replays only"}
          </p>
          <h1 className={styles.title}>Break a real server. Watch an AI engineer fix it.</h1>
          <p className={styles.lead}>
            Pick what goes wrong. A real server in AWS breaks, monitoring raises the alarm, and an AI on-call
            engineer investigates and repairs it with a small set of safe tools, step by step, in front of you.
            Open <a href={LAB_SITE} target="_blank" rel="noreferrer">lab.samsarukhanyan.com</a> in another tab to
            watch the site itself go down and come back.
          </p>
        </header>

        <StatusStrip metrics={lab.metrics} remaining={lab.status?.remainingToday ?? null} busy={busy} online={lab.online} />

        <div className={styles.layout}>
          <aside className={styles.controls} aria-label="Choose what breaks">
            <h2 className={styles.h2}>What should break?</h2>
            <ScenarioList scenarios={lab.scenarios} disabled={!lab.online || sending || busy} onPick={onBreak} />
            {busy && !notice && <p className={styles.hint}>An incident is running. Watch it on the right.</p>}
            {notice && <p className={styles.notice} role="status">{notice}</p>}
          </aside>

          <div id="lab-console" className={styles.console}>
            {shown ? (
              <IncidentPanel view={shown} scenarios={lab.scenarios} replay={isReplay} replaying={replay.playing} />
            ) : (
              <EmptyConsole />
            )}
          </div>
        </div>

        <History items={lab.history} scenarios={lab.scenarios} activeId={replayId} disabled={liveRunning}
          onReplay={(id) => { setReplayId(id); setReplayNonce((n) => n + 1); }} />
      </div>
    </section>
  );
}

function StatusStrip({ metrics, remaining, busy, online }: { metrics: Metrics | null; remaining: number | null; busy: boolean; online: boolean | null }) {
  const state = !metrics ? "asleep" : metrics.healthy ? "healthy" : "down";
  const label = { asleep: "Asleep (saving money)", healthy: "Healthy", down: "Having problems" }[state];
  return (
    <dl className={styles.strip}>
      <div>
        <dt>Lab server</dt>
        <dd><span className={`${styles.dot} ${styles[`dot_${state}`]}`} aria-hidden />{label}</dd>
      </div>
      <div>
        <dt>Response time</dt>
        <dd>{metrics?.latencyMs != null ? `${metrics.latencyMs} ms` : "–"}</dd>
      </div>
      <div>
        <dt>CPU</dt>
        <dd><Bar value={metrics?.cpuPct ?? null} /></dd>
      </div>
      <div>
        <dt>Disk</dt>
        <dd><Bar value={metrics?.diskPct ?? null} /></dd>
      </div>
      <div>
        <dt>AI engineer</dt>
        <dd>{online === null ? "…" : online ? (busy ? "On a call" : "On duty") : "Offline"}</dd>
      </div>
      <div>
        <dt>Live breaks left today</dt>
        <dd>{remaining ?? "–"}</dd>
      </div>
    </dl>
  );
}

function Bar({ value }: { value: number | null }) {
  if (value === null) return <>–</>;
  return (
    <span className={styles.bar} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
      <span className={styles.barFill} style={{ width: `${value}%` }} data-hot={value >= 90 || undefined} />
      <span className={styles.barText}>{value}%</span>
    </span>
  );
}

function ScenarioList({ scenarios, disabled, onPick }: { scenarios: ScenarioSummary[]; disabled: boolean; onPick: (id: string) => void }) {
  return (
    <ul className={styles.scenarios}>
      {scenarios.map((s) => (
        <li key={s.id}>
          <button type="button" className={styles.scenario} disabled={disabled} onClick={() => onPick(s.id)}>
            <span className={styles.scenarioTitle}>{s.title}</span>
            <span className={styles.scenarioBlurb}>{s.blurb}</span>
          </button>
        </li>
      ))}
      <li>
        <button type="button" className={`${styles.scenario} ${styles.surprise}`} disabled={disabled} onClick={() => onPick("surprise")}>
          <span className={styles.scenarioTitle}>Surprise me</span>
          <span className={styles.scenarioBlurb}>A random failure. Neither you nor the AI knows which one until the end.</span>
        </button>
      </li>
    </ul>
  );
}

function EmptyConsole() {
  return (
    <div className={styles.empty}>
      <p className={styles.emptyTitle}>Nothing is broken yet.</p>
      <p>Pick a failure on the left, or replay a real past incident below.</p>
    </div>
  );
}

const titleOf = (view: IncidentView, scenarios: ScenarioSummary[]) =>
  view.scenarioId ? scenarios.find((s) => s.id === view.scenarioId)?.title ?? view.scenarioId : "Surprise: unknown failure";

function IncidentPanel({ view, scenarios, replay, replaying }: { view: IncidentView; scenarios: ScenarioSummary[]; replay: boolean; replaying: boolean }) {
  // Keep the newest step in view by scrolling the feed box only, never the page.
  const feed = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = feed.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [view.feed.length, view.outcome, view.postmortem]);

  const current = stageIndex(view.status);
  return (
    <article className={styles.panel}>
      <header className={styles.panelHead}>
        <div>
          <p className={styles.panelKicker}>{replay ? (replaying ? "Replay" : "Replay · finished") : "Live incident"} · {view.id}</p>
          <h2 className={styles.panelTitle}>{titleOf(view, scenarios)}</h2>
        </div>
        <p className={styles.statusText} aria-live="polite">
          {view.outcome && view.resetOk !== null
            ? `${STATUS_TEXT[view.outcome.resolved ? "resolved" : "failed"]} The lab is ready for the next visitor.`
            : STATUS_TEXT[view.status]}
        </p>
      </header>

      <ol className={styles.stepper}>
        {STAGES.map((st, i) => (
          <li key={st.label} data-state={i < current ? "done" : i === current ? (view.status === "failed" ? "failed" : "now") : "todo"}>
            {st.label}
          </li>
        ))}
      </ol>

      <div className={styles.feed} ref={feed}>
        {view.feed.length === 0 && <p className={styles.waiting}>Waiting for the first signal…</p>}
        {view.feed.map((f) => <FeedRow key={f.seq} item={f} />)}
        {view.outcome && (
          <div className={`${styles.outcome} ${view.outcome.resolved ? styles.ok : styles.bad}`}>
            <p className={styles.outcomeTitle}>{view.outcome.resolved ? "Fixed" : "Not fixed"} in {Math.round(view.outcome.durationMs / 1000)} s · {view.outcome.steps} steps</p>
            <p>{view.outcome.text}</p>
            <p className={styles.meta}>
              {view.outcome.provider === "fake" ? "Scripted engineer (AI coming soon)" : `${view.outcome.provider} · ${view.outcome.model}`}
              {view.outcome.usage.inputTokens > 0 && ` · ${view.outcome.usage.inputTokens + view.outcome.usage.outputTokens} tokens`}
              {view.resetOk !== null && ` · lab ${view.resetOk ? "reset" : "reset failed"}`}
            </p>
          </div>
        )}
        {view.postmortem && (
          <details className={styles.postmortem}>
            <summary>Postmortem</summary>
            <pre>{view.postmortem}</pre>
          </details>
        )}
      </div>
    </article>
  );
}

function FeedRow({ item }: { item: FeedItem }) {
  if (item.kind === "alert") {
    return (
      <div className={styles.alert}>
        <span className={styles.badge}>Alert</span>
        <p>Monitoring: the site is in trouble.</p>
        <code>{item.detail}</code>
      </div>
    );
  }
  if (item.kind === "thought") {
    return (
      <div className={styles.thought}>
        <span className={styles.avatar} aria-hidden>AI</span>
        <p>{item.text}</p>
      </div>
    );
  }
  const args = Object.values(item.args).map(String).join(" ");
  const state = item.result === null ? "running" : item.result.ok ? "ok" : "fail";
  return (
    <details className={styles.tool} data-state={state}>
      <summary>
        <span className={styles.toolExplain}>{item.explain}</span>
        <span className={styles.toolMeta}>
          <code>{item.tool}</code>
          {state === "running" ? <span className={styles.spinner} role="img" aria-label="running" /> : <span>{state === "ok" ? "✓" : "✗"} {item.result!.durationMs < 1000 ? `${item.result!.durationMs} ms` : `${(item.result!.durationMs / 1000).toFixed(1)} s`}</span>}
        </span>
      </summary>
      <pre className={styles.terminal}>
        <span className={styles.prompt}>$ {item.tool}{args ? ` ${args}` : ""}</span>
        {"\n"}
        {item.result?.output ?? "…"}
      </pre>
    </details>
  );
}

function History({ items, scenarios, activeId, onReplay, disabled }: {
  items: IncidentSummary[]; scenarios: ScenarioSummary[]; activeId: string | null; onReplay: (id: string) => void; disabled: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <section className={styles.history} aria-label="Past incidents">
      <h2 className={styles.h2}>Real past incidents</h2>
      <ul>
        {items.map((it) => (
          <li key={it.id} className={it.id === activeId ? styles.historyActive : ""}>
            <span className={`${styles.dot} ${it.status === "resolved" ? styles.dot_healthy : styles.dot_down}`} aria-hidden />
            <span className={styles.historyTitle}>{scenarios.find((s) => s.id === it.scenarioId)?.title ?? it.scenarioId}</span>
            <span className={styles.historyMeta}>
              {it.status === "resolved" ? "fixed" : "not fixed"}
              {it.durationMs !== null && ` in ${Math.round(it.durationMs / 1000)} s`} · {new Date(it.createdAt).toLocaleString()}
            </span>
            <button type="button" className="btn-ghost" disabled={disabled} onClick={() => {
              onReplay(it.id);
              document.getElementById("lab-console")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}>Replay</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
