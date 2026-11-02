// Finished incidents on disk: <id>.jsonl holds every event, <id>.json the summary.
// One server, a few incidents a day: plain files are enough and back up with the EBS snapshots.

import { appendFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { IncidentDetailResponse, IncidentSummary } from "../../../contracts/api.js";
import type { LabEvent } from "../../../contracts/events.js";
import { config } from "./config.js";

const dir = join(config.dataDir, "incidents");
mkdirSync(dir, { recursive: true });

const safeId = (id: string) => /^[a-z0-9-]{1,40}$/.test(id);

export function appendEvent(e: LabEvent): void {
  if (!e.incidentId) return;
  try {
    appendFileSync(join(dir, `${e.incidentId}.jsonl`), JSON.stringify(e) + "\n");
  } catch (err) {
    console.error("cannot persist event", (err as Error).message); // live stream keeps working
  }
}

function readSummaries(): IncidentSummary[] {
  return readdirSync(dir).filter((f) => f.endsWith(".json")).flatMap((f) => {
    try { return [JSON.parse(readFileSync(join(dir, f), "utf8")) as IncidentSummary]; }
    catch { return []; } // half-written file: skip it rather than break the API
  });
}

export function saveSummary(s: IncidentSummary): void {
  writeFileSync(join(dir, `${s.id}.json`), JSON.stringify(s));
}

export function listSummaries(limit: number, before?: string): IncidentSummary[] {
  const all = readSummaries().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const start = before ? all.findIndex((s) => s.id === before) + 1 : 0;
  return all.slice(start, start + limit);
}

export function loadIncident(id: string): IncidentDetailResponse | null {
  if (!safeId(id)) return null;
  try {
    const summary = JSON.parse(readFileSync(join(dir, `${id}.json`), "utf8")) as IncidentSummary;
    const events = readFileSync(join(dir, `${id}.jsonl`), "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as LabEvent);
    const pm = events.find((e) => e.type === "postmortem");
    return { ...summary, events, postmortem: pm?.type === "postmortem" ? pm.data.markdown : null };
  } catch {
    return null;
  }
}

export function countSince(isoDay: string): number {
  return readSummaries().filter((s) => s.createdAt >= isoDay).length;
}
