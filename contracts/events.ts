// Live event stream: Control Plane -> browser over SSE (GET /api/events).
// Every event is also stored, so a finished incident can be replayed from its events alone.

export type IncidentStatus =
  | "queued"        // waiting for the lab to be free
  | "waking"        // lab server was asleep and is booting (~1 min)
  | "breaking"      // chaos script is running
  | "detecting"     // prober waits for the failure to show up
  | "investigating" // agent is reading the system
  | "fixing"        // agent ran an action tool
  | "verifying"     // oracle checks the lab is healthy again
  | "resolved"
  | "failed"        // agent gave up, hit the step/time limit, or the oracle disagreed
  | "resetting";    // reset script restores the lab after resolved/failed

export interface Metrics {
  healthy: boolean;
  httpStatus: number | null; // null = no response
  latencyMs: number | null;
  cpuPct: number;
  diskPct: number;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
}

interface Base<T extends string, D> {
  seq: number;          // monotonic across the whole stream; used as the SSE id / Last-Event-ID
  incidentId: string | null;
  ts: string;           // ISO 8601
  type: T;
  data: D;
}

export type LabEvent =
  | Base<"incident.created", { mode: "chosen" | "surprise"; scenarioId: string | null }> // scenarioId null while hidden (surprise)
  | Base<"incident.status", { status: IncidentStatus }>
  | Base<"alert", { detail: string }>                                // what the prober saw, e.g. "connection refused"
  | Base<"agent.thought", { text: string }>                          // model's short reasoning between tool calls
  | Base<"agent.tool_call", { callId: string; tool: string; args: Record<string, unknown>; explain: string }> // explain: plain-language line from tools.ts, no tokens spent
  | Base<"agent.tool_result", { callId: string; ok: boolean; output: string; durationMs: number }>   // output already truncated (tools.ts OUTPUT_LIMIT)
  | Base<"metrics", Metrics>                                         // every 5 s, incidentId null when idle
  | Base<"incident.resolved", { summary: string; durationMs: number; steps: number; provider: string; model: string; usage: Usage }>
  | Base<"incident.failed", { reason: string; durationMs: number; steps: number; provider: string; model: string; usage: Usage }>
  | Base<"incident.revealed", { scenarioId: string }>               // after resolved/failed in surprise mode
  | Base<"postmortem", { markdown: string }>
  | Base<"lab.reset", { ok: boolean }>
  | Base<"agent.presence", { online: boolean }>;                     // false = live mode off, UI offers replays

export type LabEventType = LabEvent["type"];
