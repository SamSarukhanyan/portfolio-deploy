// HTTP API of the Control Plane, served under /api behind nginx.
// All bodies are JSON. Errors: { error: string } with the status codes listed per route.

import type { IncidentStatus, LabEvent, Metrics, Usage } from "./events.js";

export const LIMITS = {
  queueMax: 5,                 // POST /incidents -> 429 "queue_full" beyond this
  perIpCooldownSec: 600,       // one break per IP per 10 min -> 429 "cooldown"
  dailyLiveIncidents: 50,      // UTC day -> 429 "daily_limit"; replays stay available
  agentMaxSteps: 10,           // tool calls per incident (resolve not counted), then status "failed"
  incidentTimeoutSec: 300,     // from "investigating" to "verifying", then "failed"
} as const;

export interface ScenarioSummary {
  id: string;     // see contracts/scenarios.md
  title: string;  // shown on the button, e.g. "Stop the web server"
  blurb: string;  // one plain-language sentence for non-programmers
}

// GET /api/scenarios -> 200
export type ScenariosResponse = ScenarioSummary[];

// GET /api/lab/status -> 200
export interface LabStatusResponse {
  status: IncidentStatus | "idle";
  currentIncidentId: string | null;
  queueLength: number;
  agentOnline: boolean;
  remainingToday: number;
  metrics: Metrics | null;
}

// POST /api/incidents -> 202 | 400 (unknown scenario) | 429 (limits) | 503 (agent offline)
export const LANGS = ["en", "ru", "hy"] as const;
export type Lang = (typeof LANGS)[number];

export interface CreateIncidentRequest {
  scenario: string | "surprise";
  lang?: Lang; // the agent writes its plain-language notes in this language; default "en"
}
export interface CreateIncidentResponse {
  incidentId: string;
  position: number; // 0 = starts now
}
export interface RateLimitedResponse {
  error: "queue_full" | "cooldown" | "daily_limit";
  retryAfterSec: number;
}

export interface IncidentSummary {
  id: string;
  scenarioId: string | null; // null until revealed
  status: IncidentStatus;
  createdAt: string;
  durationMs: number | null;
  steps: number;
  provider: string | null;
  model: string | null;
  usage: Usage | null;
}

// GET /api/incidents?limit=20&before=<id> -> 200, newest first, only finished incidents
export type IncidentListResponse = IncidentSummary[];

// GET /api/incidents/:id -> 200 | 404. Events in seq order; the UI replays them with original timing.
export interface IncidentDetailResponse extends IncidentSummary {
  events: LabEvent[];
  postmortem: string | null;
}

// GET /api/events -> text/event-stream
//   id: <seq>   event: <LabEvent.type>   data: <LabEvent JSON>
//   Honors Last-Event-ID (resends missed events still in memory, max 500).
//   Sends a comment line ": ping" every 15 s to keep proxies open.
