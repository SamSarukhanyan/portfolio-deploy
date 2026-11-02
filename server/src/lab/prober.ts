// What a visitor would experience: /, the JS bundle it loads, and /api/health with its latency.

import type { Metrics } from "../../../contracts/events.js";
import { config } from "./config.js";

export interface Probe {
  healthy: boolean;
  httpStatus: number | null;
  latencyMs: number | null; // of /api/health, the endpoint that does real work
  detail: string;
}

async function get(path: string): Promise<{ status: number | null; ms: number; body: string; error?: string }> {
  const started = Date.now();
  try {
    const res = await fetch(config.labUrl + path, { signal: AbortSignal.timeout(8000), redirect: "manual" });
    return { status: res.status, ms: Date.now() - started, body: await res.text() };
  } catch (e) {
    return { status: null, ms: Date.now() - started, body: "", error: (e as Error).cause ? String((e as Error).cause) : (e as Error).message };
  }
}

export async function probe(): Promise<Probe> {
  const home = await get("/");
  if (home.status !== 200) {
    return { healthy: false, httpStatus: home.status, latencyMs: null, detail: `/ ${home.status ?? home.error ?? "no response"}` };
  }
  const bundle = /src="(\/app\.[^"]+\.js)"/.exec(home.body)?.[1];
  const js = bundle ? await get(bundle) : null;
  const health = await get("/api/health");
  const parts = [`/ 200 ${home.ms}ms`, `${bundle ?? "bundle"} ${js?.status ?? "missing"}`, `/api/health ${health.status ?? "no response"} ${health.ms}ms`];
  const healthy = js?.status === 200 && health.status === 200 && health.ms < config.slowHealthMs;
  return { healthy, httpStatus: health.status, latencyMs: health.ms, detail: parts.join(", ") };
}

export function toMetrics(p: Probe, cpuPct: number, diskPct: number): Metrics {
  return { healthy: p.healthy, httpStatus: p.httpStatus, latencyMs: p.latencyMs, cpuPct, diskPct };
}
