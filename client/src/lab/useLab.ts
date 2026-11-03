// Live connection to the Control Plane (contracts/api.ts) plus replays of finished incidents.

import { useCallback, useEffect, useRef, useState } from "react";
import type { IncidentDetailResponse, IncidentSummary, LabStatusResponse, ScenarioSummary } from "../../../contracts/api";
import type { LabEvent, Metrics } from "../../../contracts/events";
import { reduce, type IncidentView } from "./incident";
import { SCENARIOS } from "../../../contracts/scenarios";

const EVENT_TYPES: LabEvent["type"][] = ["incident.created", "incident.status", "alert", "agent.thought", "agent.tool_call",
  "agent.tool_result", "metrics", "incident.resolved", "incident.failed", "incident.revealed", "postmortem", "lab.reset", "agent.presence"];

const getJson = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(String(res.status));
  return res.json() as Promise<T>;
};

export type BreakResult = { ok: true } | { ok: false; code: string; mins: number };

export function useLab() {
  const [online, setOnline] = useState<boolean | null>(null); // null = still connecting
  const [status, setStatus] = useState<LabStatusResponse | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([...SCENARIOS]); // shown even while offline
  const [history, setHistory] = useState<IncidentSummary[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [live, setLive] = useState<IncidentView | null>(null);
  const created = useRef(new Map<string, LabEvent>());

  const refresh = useCallback(async () => {
    try {
      const [s, h] = await Promise.all([getJson<LabStatusResponse>("/api/lab/status"), getJson<IncidentSummary[]>("/api/incidents?limit=12")]);
      setStatus(s);
      setHistory(h);
      if (s.metrics) setMetrics(s.metrics);
      setOnline(s.agentOnline);
    } catch {
      setOnline(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    getJson<ScenarioSummary[]>("/api/scenarios").then(setScenarios).catch(() => undefined);

    // EventSource retries by itself on network drops, but gives up for good on an HTTP error
    // (Control Plane restarting, too many viewers). Then we reopen it with a growing delay.
    let es: EventSource | null = null;
    let lastSeq = 0;
    let retryMs = 3000;
    let retry: number | undefined;
    let closed = false;

    const onEvent = (msg: MessageEvent<string>) => {
      let e: LabEvent;
      try { e = JSON.parse(msg.data) as LabEvent; } catch { return; }
      lastSeq = Math.max(lastSeq, e.seq);
      if (e.type === "metrics") setMetrics(e.data);
      else if (e.type === "agent.presence") setOnline(e.data.online);
      else setLive((v) => reduce(v, e, created.current));
      if (e.type === "incident.status" || e.type === "lab.reset") void refresh(); // busy flag, archive
    };
    const connect = () => {
      es = new EventSource(lastSeq ? `/api/events?after=${lastSeq}` : "/api/events");
      EVENT_TYPES.forEach((t) => es!.addEventListener(t, onEvent as EventListener));
      es.onopen = () => {
        retryMs = 3000;
        void refresh();
      };
      es.onerror = () => {
        if (es?.readyState !== EventSource.CLOSED || closed) return;
        setOnline(false);
        retry = window.setTimeout(connect, retryMs);
        retryMs = Math.min(retryMs * 2, 60_000);
      };
    };
    connect();
    return () => {
      closed = true;
      window.clearTimeout(retry);
      es?.close();
    };
  }, [refresh]);

  const breakIt = useCallback(async (scenario: string, lang: string): Promise<BreakResult> => {
    const res = await fetch("/api/incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario, lang }),
    }).catch(() => null);
    if (!res) return { ok: false, code: "unreachable", mins: 0 };
    if (res.ok) return { ok: true };
    const body = (await res.json().catch(() => ({}))) as { error?: string; retryAfterSec?: number };
    return { ok: false, code: body.error ?? "generic", mins: Math.max(1, Math.ceil((body.retryAfterSec ?? 60) / 60)) };
  }, []);

  return { online, status, scenarios, history, metrics, live, breakIt };
}

/** Plays a finished incident back with its original rhythm (long waits shortened). */
export function useReplay(id: string | null, nonce = 0, speed = 1) {
  const [view, setView] = useState<IncidentView | null>(null);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    setView(null);
    if (!id) return;
    let cancelled = false;
    setPlaying(true);
    getJson<IncidentDetailResponse>(`/api/incidents/${encodeURIComponent(id)}`).then((inc) => {
      const events = inc.events.filter((e) => e.type !== "metrics");
      let i = 0;
      const step = () => {
        if (cancelled) return;
        const e = events[i++];
        if (!e) return setPlaying(false);
        setView((v) => reduce(v, e));
        const next = events[i];
        const gap = next ? Date.parse(next.ts) - Date.parse(e.ts) : 0;
        timer.current = window.setTimeout(step, Math.min(gap, 1800) / speed);
      };
      step();
    }).catch(() => !cancelled && setPlaying(false));
    return () => {
      cancelled = true;
      window.clearTimeout(timer.current);
    };
  }, [id, nonce, speed]);

  return { view, playing };
}
