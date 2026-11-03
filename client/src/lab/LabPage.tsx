import { useEffect, useRef, useState } from "react";
import type { IncidentSummary, ScenarioSummary } from "../../../contracts/api";
import type { Metrics } from "../../../contracts/events";
import { stageIndex, STAGE_COUNT, type FeedItem, type IncidentView } from "./incident";
import { LANGS, texts, useLabLang, type Lang, type Texts } from "./i18n";
import { useLab, useReplay } from "./useLab";
import styles from "./LabPage.module.css";

const LAB_SITE = "https://lab.samsarukhanyan.com";

export function LabPage() {
  const [lang, setLang] = useLabLang();
  const t = texts(lang);
  const lab = useLab();
  const [replayId, setReplayId] = useState<string | null>(null);
  const [replayNonce, setReplayNonce] = useState(0); // clicking Replay again restarts it
  const replay = useReplay(replayId, replayNonce);
  const [notice, setNotice] = useState<{ code: string; mins: number } | null>(null);
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
    const r = await lab.breakIt(id, lang);
    setSending(false);
    if (!r.ok) setNotice({ code: r.code, mins: r.mins });
    else document.getElementById("lab-console")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const labSiteUrl = `${LAB_SITE}/?lang=${lang}`;

  return (
    <section className={`section ${styles.page}`}>
      <div className="shell">
        <header className={styles.intro}>
          <div className={styles.introTop}>
            <p className={styles.eyebrow}>
              <span className={`${styles.liveDot} ${lab.online ? styles.liveDotOn : ""}`} aria-hidden />
              {t.eyebrow} · {lab.online === null ? t.connecting : lab.online ? t.live : t.replaysOnly}
            </p>
            <LangSwitch lang={lang} onChange={setLang} label={t.language} />
          </div>
          <h1 className={styles.title}>{t.title}</h1>
          <p className={styles.lead}>
            {t.leadBefore}
            <a href={labSiteUrl} target="_blank" rel="noreferrer">lab.samsarukhanyan.com</a>
            {t.leadAfter}
          </p>
        </header>

        <StatusStrip t={t} metrics={lab.metrics} remaining={lab.status?.remainingToday ?? null} busy={busy} online={lab.online} />

        <div className={styles.layout}>
          <aside className={styles.controls} aria-label={t.chooseAria}>
            <h2 className={styles.h2}>{t.whatBreaks}</h2>
            <ScenarioList t={t} scenarios={lab.scenarios} disabled={!lab.online || sending || busy} onPick={onBreak} />
            {busy && !notice && <p className={styles.hint}>{t.busyHint}</p>}
            {notice && (
              <p className={styles.notice} role="status">{t.fill(t.err[notice.code] ?? t.err.generic!, { m: notice.mins })}</p>
            )}
          </aside>

          <div id="lab-console" className={styles.console}>
            {shown ? (
              <IncidentPanel t={t} view={shown} scenarios={lab.scenarios} replay={isReplay} replaying={replay.playing} />
            ) : (
              <EmptyConsole t={t} />
            )}
          </div>
        </div>

        <History t={t} lang={lang} items={lab.history} scenarios={lab.scenarios} activeId={replayId} disabled={liveRunning}
          onReplay={(id) => { setReplayId(id); setReplayNonce((n) => n + 1); }} />
      </div>
    </section>
  );
}

function LangSwitch({ lang, onChange, label }: { lang: Lang; onChange: (l: Lang) => void; label: string }) {
  return (
    <div className={styles.langs} role="group" aria-label={label}>
      {LANGS.map((l) => (
        <button key={l.id} type="button" lang={l.id} title={l.name} aria-pressed={l.id === lang}
          className={l.id === lang ? styles.langOn : ""} onClick={() => onChange(l.id)}>
          {l.label}
        </button>
      ))}
    </div>
  );
}

function StatusStrip({ t, metrics, remaining, busy, online }: { t: Texts; metrics: Metrics | null; remaining: number | null; busy: boolean; online: boolean | null }) {
  const state = !metrics ? "asleep" : metrics.healthy ? "healthy" : "down";
  const label = { asleep: t.asleep, healthy: t.healthy, down: t.down }[state];
  return (
    <dl className={styles.strip}>
      <div>
        <dt>{t.labServer}</dt>
        <dd><span className={`${styles.dot} ${styles[`dot_${state}`]}`} aria-hidden />{label}</dd>
      </div>
      <div>
        <dt>{t.responseTime}</dt>
        <dd>{metrics?.latencyMs != null ? `${metrics.latencyMs} ms` : "–"}</dd>
      </div>
      <div>
        <dt>{t.cpu}</dt>
        <dd><Bar value={metrics?.cpuPct ?? null} /></dd>
      </div>
      <div>
        <dt>{t.disk}</dt>
        <dd><Bar value={metrics?.diskPct ?? null} /></dd>
      </div>
      <div>
        <dt>{t.aiEngineer}</dt>
        <dd>{online === null ? "…" : online ? (busy ? t.onCall : t.onDuty) : t.offline}</dd>
      </div>
      <div>
        <dt>{t.breaksLeft}</dt>
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

function ScenarioList({ t, scenarios, disabled, onPick }: { t: Texts; scenarios: ScenarioSummary[]; disabled: boolean; onPick: (id: string) => void }) {
  return (
    <ul className={styles.scenarios}>
      {scenarios.map((s) => {
        const text = t.scenario(s.id, s);
        return (
          <li key={s.id}>
            <button type="button" className={styles.scenario} disabled={disabled} onClick={() => onPick(s.id)}>
              <span className={styles.scenarioTitle}>{text.title}</span>
              <span className={styles.scenarioBlurb}>{text.blurb}</span>
            </button>
          </li>
        );
      })}
      <li>
        <button type="button" className={`${styles.scenario} ${styles.surprise}`} disabled={disabled} onClick={() => onPick("surprise")}>
          <span className={styles.scenarioTitle}>{t.surpriseTitle}</span>
          <span className={styles.scenarioBlurb}>{t.surpriseBlurb}</span>
        </button>
      </li>
    </ul>
  );
}

function EmptyConsole({ t }: { t: Texts }) {
  return (
    <div className={styles.empty}>
      <div>
        <p className={styles.emptyTitle}>{t.emptyTitle}</p>
        <p>{t.emptyBody}</p>
      </div>
      <div className={styles.how}>
        <p className={styles.howTitle}>{t.howTitle}</p>
        <ol>
          {t.how.map((step) => <li key={step}>{step}</li>)}
        </ol>
      </div>
    </div>
  );
}

function IncidentPanel({ t, view, scenarios, replay, replaying }: { t: Texts; view: IncidentView; scenarios: ScenarioSummary[]; replay: boolean; replaying: boolean }) {
  // Keep the newest step in view by scrolling the feed box only, never the page.
  const feed = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = feed.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [view.feed.length, view.outcome, view.postmortem]);

  const current = stageIndex(view.status);
  const known = scenarios.find((s) => s.id === view.scenarioId);
  const title = view.scenarioId ? t.scenario(view.scenarioId, known).title : t.surpriseUnknown;
  return (
    <article className={styles.panel}>
      <header className={styles.panelHead}>
        <div>
          <p className={styles.panelKicker}>{replay ? (replaying ? t.replay : t.replayDone) : t.liveIncident} · {view.id}</p>
          <h2 className={styles.panelTitle}>{title}</h2>
        </div>
        <p className={styles.statusText} aria-live="polite">
          {view.outcome && view.resetOk !== null
            ? `${t.status[view.outcome.resolved ? "resolved" : "failed"]} ${t.readyNext}`
            : t.status[view.status]}
        </p>
      </header>

      <ol className={styles.stepper}>
        {Array.from({ length: STAGE_COUNT }, (_, i) => (
          <li key={i} data-state={i < current ? "done" : i === current ? (view.status === "failed" ? "failed" : "now") : "todo"}>
            {t.stages[i]}
          </li>
        ))}
      </ol>

      <div className={styles.feed} ref={feed}>
        {view.feed.length === 0 && <p className={styles.waiting}>{t.waitingSignal}</p>}
        {view.feed.map((f) => <FeedRow key={f.seq} t={t} item={f} />)}
        {view.outcome && (
          <div className={`${styles.outcome} ${view.outcome.resolved ? styles.ok : styles.bad}`}>
            <p className={styles.outcomeTitle}>
              {view.outcome.resolved ? t.fixed : t.notFixed} · {t.fill(t.outcomeStats, { s: Math.round(view.outcome.durationMs / 1000), n: view.outcome.steps })}
            </p>
            <p>{view.outcome.text}</p>
            <p className={styles.meta}>
              {view.outcome.provider === "fake" ? t.scripted : `${view.outcome.provider} · ${view.outcome.model}`}
              {view.outcome.usage.inputTokens > 0 && ` · ${t.fill(t.tokens, { n: view.outcome.usage.inputTokens + view.outcome.usage.outputTokens })}`}
              {view.resetOk !== null && ` · ${view.resetOk ? t.labReset : t.resetFailed}`}
            </p>
          </div>
        )}
        {view.postmortem && (
          <details className={styles.postmortem}>
            <summary>{t.postmortem}</summary>
            <pre>{view.postmortem}</pre>
          </details>
        )}
      </div>
    </article>
  );
}

function FeedRow({ t, item }: { t: Texts; item: FeedItem }) {
  if (item.kind === "alert") {
    return (
      <div className={styles.alert}>
        <span className={styles.badge}>{t.alert}</span>
        <p>{t.alertText}</p>
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
        <span className={styles.toolExplain}>{t.explain(item.tool, item.args)}</span>
        <span className={styles.toolMeta}>
          <code>{item.tool}</code>
          {state === "running" ? <span className={styles.spinner} role="img" aria-label={t.running} /> : <span>{state === "ok" ? "✓" : "✗"} {item.result!.durationMs < 1000 ? `${item.result!.durationMs} ms` : `${(item.result!.durationMs / 1000).toFixed(1)} s`}</span>}
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

function History({ t, lang, items, scenarios, activeId, onReplay, disabled }: {
  t: Texts; lang: Lang; items: IncidentSummary[]; scenarios: ScenarioSummary[]; activeId: string | null; onReplay: (id: string) => void; disabled: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <section className={styles.history} aria-label={t.pastAria}>
      <h2 className={styles.h2}>{t.pastIncidents}</h2>
      <p className={styles.historyNote}>{t.aiNotesLang}</p>
      <ul>
        {items.map((it) => (
          <li key={it.id} className={it.id === activeId ? styles.historyActive : ""}>
            <span className={`${styles.dot} ${it.status === "resolved" ? styles.dot_healthy : styles.dot_down}`} aria-hidden />
            <span className={styles.historyTitle}>{t.scenario(it.scenarioId, scenarios.find((s) => s.id === it.scenarioId)).title}</span>
            <span className={styles.historyMeta}>
              {it.status === "resolved" && it.durationMs !== null ? t.fill(t.fixedIn, { s: Math.round(it.durationMs / 1000) }) : t.notFixedIn}
              {" · "}{new Date(it.createdAt).toLocaleString(lang)}
            </span>
            <button type="button" className="btn-ghost" disabled={disabled} onClick={() => {
              onReplay(it.id);
              document.getElementById("lab-console")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}>{t.replayBtn}</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
