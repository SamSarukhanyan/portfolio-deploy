// Turns the event stream (contracts/events.ts) into what the console shows. Pure, so the live
// stream and a replay of a finished incident render through the same code.

import type { IncidentStatus, LabEvent, Usage } from "../../../contracts/events";

export type FeedItem =
  | { kind: "alert"; seq: number; ts: string; detail: string }
  | { kind: "thought"; seq: number; ts: string; text: string }
  | { kind: "tool"; seq: number; ts: string; callId: string; tool: string; args: Record<string, unknown>; explain: string;
      result: { ok: boolean; output: string; durationMs: number } | null };

export interface Outcome {
  resolved: boolean;
  text: string; // summary when resolved, reason when failed
  durationMs: number;
  steps: number;
  provider: string;
  model: string;
  usage: Usage;
}

export interface IncidentView {
  id: string;
  mode: "chosen" | "surprise";
  scenarioId: string | null;
  status: IncidentStatus;
  startedAt: string;
  feed: FeedItem[];
  outcome: Outcome | null;
  postmortem: string | null;
  resetOk: boolean | null;
}

const fresh = (id: string, ts: string, mode: IncidentView["mode"] = "chosen", scenarioId: string | null = null): IncidentView =>
  ({ id, mode, scenarioId, status: "queued", startedAt: ts, feed: [], outcome: null, postmortem: null, resetOk: null });

/**
 * One incident on screen at a time. Another incident takes over only once it actually starts
 * (status past "queued") and the one shown has finished, so a visitor queuing behind a running
 * incident does not blank the console. `created` remembers mode/scenario until then.
 */
export function reduce(view: IncidentView | null, e: LabEvent, created?: Map<string, LabEvent>): IncidentView | null {
  if (e.type === "incident.created") {
    created?.set(e.incidentId!, e);
    return view === null ? fresh(e.incidentId!, e.ts, e.data.mode, e.data.scenarioId) : view;
  }
  if (e.incidentId && e.incidentId !== view?.id) {
    const takesOver = e.type === "incident.status" && e.data.status !== "queued" && (view === null || view.outcome !== null || view.status === "queued");
    if (!takesOver) return view;
    const c = created?.get(e.incidentId);
    view = c?.type === "incident.created" ? fresh(e.incidentId, c.ts, c.data.mode, c.data.scenarioId) : fresh(e.incidentId, e.ts);
  }
  if (!view) return view;
  if (view.feed.some((f) => f.seq === e.seq)) return view; // resent after a reconnect

  switch (e.type) {
    case "incident.status":
      return { ...view, status: e.data.status };
    case "alert":
      return { ...view, feed: [...view.feed, { kind: "alert", seq: e.seq, ts: e.ts, detail: e.data.detail }] };
    case "agent.thought":
      return { ...view, feed: [...view.feed, { kind: "thought", seq: e.seq, ts: e.ts, text: e.data.text }] };
    case "agent.tool_call":
      return { ...view, feed: [...view.feed, { kind: "tool", seq: e.seq, ts: e.ts, callId: e.data.callId, tool: e.data.tool,
        args: e.data.args, explain: e.data.explain, result: null }] };
    case "agent.tool_result":
      return { ...view, feed: view.feed.map((f) => (f.kind === "tool" && f.callId === e.data.callId
        ? { ...f, result: { ok: e.data.ok, output: e.data.output, durationMs: e.data.durationMs } } : f)) };
    case "incident.resolved":
      return { ...view, outcome: { resolved: true, text: e.data.summary, ...pick(e.data) } };
    case "incident.failed":
      return { ...view, outcome: { resolved: false, text: e.data.reason, ...pick(e.data) } };
    case "incident.revealed":
      return { ...view, scenarioId: e.data.scenarioId };
    case "postmortem":
      return { ...view, postmortem: e.data.markdown };
    case "lab.reset":
      return { ...view, resetOk: e.data.ok };
    default:
      return view;
  }
}

function pick(d: { durationMs: number; steps: number; provider: string; model: string; usage: Usage }) {
  return { durationMs: d.durationMs, steps: d.steps, provider: d.provider, model: d.model, usage: d.usage };
}

/** Stepper stages in order; their labels live in i18n.ts (stages). */
const STAGE_STATUSES: IncidentStatus[][] = [
  ["queued", "waking"], ["breaking"], ["detecting"], ["investigating"], ["fixing"], ["verifying"], ["resolved", "failed", "resetting"],
];
export const STAGE_COUNT = STAGE_STATUSES.length;
export const stageIndex = (s: IncidentStatus) => STAGE_STATUSES.findIndex((st) => st.includes(s));
