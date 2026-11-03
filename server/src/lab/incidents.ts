// One incident at a time: wake -> break -> detect -> agent -> verify (oracle) -> postmortem -> reset.
// Also enforces the limits from contracts/api.ts and puts the lab to sleep when idle.

import { randomUUID } from "node:crypto";
import { LIMITS, type CreateIncidentResponse, type Lang, type RateLimitedResponse } from "../../../contracts/api.js";
import type { IncidentStatus, LabEvent, Usage } from "../../../contracts/events.js";
import { SCENARIOS } from "../../../contracts/scenarios.js";
import { fakeAgent } from "../agent/fake.js";
import { llmAgent } from "../agent/llm.js";
import { claudeProvider, ollamaProvider } from "../agent/providers.js";
import type { Agent } from "../agent/types.js";
import { labState, runDoc, sleepLab, wakeLab } from "./aws.js";
import { emit, subscribe } from "./bus.js";
import { config } from "./config.js";
import { probe } from "./prober.js";
import { countSince, saveSummary } from "./store.js";
import { createToolbox, isFix, StepLimitError } from "./toolbox.js";

interface Job {
  id: string;
  scenarioId: string;
  mode: "chosen" | "surprise";
  lang: Lang;
  createdAt: string;
}

const queue: Job[] = [];
let current: Job | null = null;
let status: IncidentStatus | "idle" = "idle";
let lastActivity = Date.now();
let labDirty = true; // rebuild before the next incident: at start (a restart may have cut one short) or after a failed reset
const lastByIp = new Map<string, number>();
const noUsage: Usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const labStatus = () => ({ status, currentIncidentId: current?.id ?? null, queueLength: queue.length });

// Live incidents accepted today (UTC), counted in memory; seeded from disk once at startup.
const today = () => new Date().toISOString().slice(0, 10);
let counted = { day: today(), n: countSince(today()) };
const acceptedToday = () => (counted.day === today() ? counted.n : (counted = { day: today(), n: 0 }).n);
export const remainingToday = () => Math.max(0, LIMITS.dailyLiveIncidents - acceptedToday());

export const agentOnline = () =>
  config.agent === "fake" || config.agent === "ollama" || (config.agent === "claude" && !!process.env.ANTHROPIC_API_KEY);

const provider = config.agent === "claude" ? claudeProvider() : config.agent === "ollama" ? ollamaProvider() : null;

function agentFor(job: Job): Agent {
  if (provider) return llmAgent(provider);
  if (config.agent === "fake") return fakeAgent(job.scenarioId);
  throw new Error(`unknown agent "${config.agent}"`);
}

function setStatus(job: Job, s: IncidentStatus): void {
  status = s;
  emit({ incidentId: job.id, type: "incident.status", data: { status: s } });
}

export function createIncident(scenario: string, ip: string, lang: Lang = "en"): CreateIncidentResponse | RateLimitedResponse | { error: string } {
  const surprise = scenario === "surprise";
  if (!surprise && !SCENARIOS.some((s) => s.id === scenario)) return { error: "unknown_scenario" };
  if (!agentOnline()) return { error: "agent_offline" };

  const since = Date.now() - (lastByIp.get(ip) ?? 0);
  if (since < LIMITS.perIpCooldownSec * 1000) return { error: "cooldown", retryAfterSec: Math.ceil((LIMITS.perIpCooldownSec * 1000 - since) / 1000) };
  if (queue.length >= LIMITS.queueMax) return { error: "queue_full", retryAfterSec: 120 };
  if (remainingToday() <= 0) return { error: "daily_limit", retryAfterSec: 86_400 - Math.floor((Date.now() % 86_400_000) / 1000) };

  const job: Job = {
    id: new Date().toISOString().slice(0, 10) + "-" + randomUUID().slice(0, 8),
    scenarioId: surprise ? SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)]!.id : scenario,
    mode: surprise ? "surprise" : "chosen",
    lang,
    createdAt: new Date().toISOString(),
  };
  lastByIp.set(ip, Date.now());
  acceptedToday();
  counted.n++;
  queue.push(job);
  emit({ incidentId: job.id, type: "incident.created", data: { mode: job.mode, scenarioId: surprise ? null : job.scenarioId } });
  emit({ incidentId: job.id, type: "incident.status", data: { status: "queued" } });
  void pump();
  return { incidentId: job.id, position: queue.length - 1 + (current ? 1 : 0) };
}

async function pump(): Promise<void> {
  if (current) return;
  while ((current = queue.shift() ?? null)) {
    try {
      await runIncident(current);
    } catch (e) {
      console.error(`incident ${current.id} crashed`, e);
    }
    lastActivity = Date.now();
  }
  status = "idle";
}

/**
 * Two bad checks in a row, or give up after about a minute. A check is bad when a visitor would
 * notice (probe) or the CPU is pinned: a starved 2-vCPU box can still answer quickly enough.
 */
async function detect(): Promise<string | null> {
  let bad = 0;
  for (let i = 0; i < 20; i++) {
    const p = await probe();
    let detail = p.detail;
    let sick = !p.healthy;
    if (!sick) {
      const out = (await runDoc("lab-get_metrics", {}, 20_000)).output;
      const cpu = Number(/cpu_pct=(\d+)/.exec(out)?.[1] ?? 0);
      const disk = Number(/lab_disk_pct=(\d+)/.exec(out)?.[1] ?? 0);
      if (cpu >= 90) detail += `, CPU ${cpu}%`;
      if (disk >= 95) detail += `, /var/lab disk ${disk}%`;
      sick = cpu >= 90 || disk >= 95;
    }
    bad = sick ? bad + 1 : 0;
    if (bad >= 2) return detail;
    await sleep(2000);
  }
  return null;
}

async function runIncident(job: Job): Promise<void> {
  const started = Date.now();
  const events: LabEvent[] = [];
  const unsubscribe = subscribe((e) => e.incidentId === job.id && events.push(e));
  let outcome: { resolved: boolean; summary: string; reason: string; provider: string; model: string; usage: Usage; steps: number } = {
    resolved: false, summary: "", reason: "", provider: config.agent, model: "", usage: noUsage, steps: 0,
  };

  try {
    if ((await labState()) !== "running") {
      setStatus(job, "waking");
      await wakeLab();
    }
    if (labDirty) {
      setStatus(job, "resetting");
      const rebuilt = await runDoc("lab-provision", {}, 300_000);
      if (!rebuilt.ok) throw new Error(`lab could not be reset: ${rebuilt.output}`);
      labDirty = false;
    }

    setStatus(job, "breaking");
    const broke = await runDoc("lab-scenario", { Scenario: job.scenarioId, Step: "break" });
    if (!broke.ok) throw new Error(`break failed: ${broke.output}`);

    setStatus(job, "detecting");
    const alert = await detect();
    if (!alert) throw new Error("the failure never showed up in the probes");
    emit({ incidentId: job.id, type: "alert", data: { detail: alert } });

    setStatus(job, "investigating");
    const tools = createToolbox(job.id, () => setStatus(job, "fixing"));
    const timeout = AbortSignal.timeout(LIMITS.incidentTimeoutSec * 1000);
    const agent = agentFor(job);
    try {
      const r = await Promise.race([
        agent({ alert, lang: job.lang, tools, think: (text) => emit({ incidentId: job.id, type: "agent.thought", data: { text } }), signal: timeout }),
        new Promise<never>((_, reject) => timeout.addEventListener("abort", () => reject(new Error(`time limit (${LIMITS.incidentTimeoutSec}s) reached`)))),
      ]);
      outcome = { ...outcome, provider: r.provider, model: r.model, usage: r.usage };
    } catch (e) {
      outcome.reason = e instanceof StepLimitError || e instanceof Error ? e.message : String(e);
    }
    tools.close(); // a timed-out agent may still be running: from here on its calls are refused
    outcome.steps = tools.steps;

    setStatus(job, "verifying");
    const oracle = await runDoc("lab-scenario", { Scenario: job.scenarioId, Step: "oracle" });
    outcome.summary = tools.resolution ?? "";
    if (tools.resolution && oracle.ok) outcome.resolved = true;
    else if (!outcome.reason) outcome.reason = tools.resolution ? `agent said fixed, but the check disagrees: ${oracle.output}` : "agent stopped without fixing the site";
  } catch (e) {
    outcome.reason = (e as Error).message;
  }

  const durationMs = Date.now() - started;
  const { provider, model, usage, steps } = outcome;
  if (outcome.resolved) {
    setStatus(job, "resolved");
    emit({ incidentId: job.id, type: "incident.resolved", data: { summary: outcome.summary, durationMs, steps, provider, model, usage } });
  } else {
    setStatus(job, "failed");
    emit({ incidentId: job.id, type: "incident.failed", data: { reason: outcome.reason, durationMs, steps, provider, model, usage } });
  }
  if (job.mode === "surprise") emit({ incidentId: job.id, type: "incident.revealed", data: { scenarioId: job.scenarioId } });
  emit({ incidentId: job.id, type: "postmortem", data: { markdown: postmortem(job, events, outcome.resolved, durationMs) } });

  setStatus(job, "resetting");
  const reset = await runDoc("lab-provision", {}, 300_000).catch((e) => ({ ok: false, output: (e as Error).message }));
  labDirty = !reset.ok;
  emit({ incidentId: job.id, type: "lab.reset", data: { ok: reset.ok } });
  unsubscribe();

  saveSummary({ id: job.id, scenarioId: job.scenarioId, status: outcome.resolved ? "resolved" : "failed", createdAt: job.createdAt,
    durationMs, steps, provider, model, usage });
}

/** Template postmortem from the event log; stage 6 lets the agent write it. */
function postmortem(job: Job, events: LabEvent[], resolved: boolean, durationMs: number): string {
  const alert = events.find((e) => e.type === "alert");
  const actions = events.filter((e) => e.type === "agent.tool_call" && isFix(e.data.tool));
  const title = SCENARIOS.find((s) => s.id === job.scenarioId)?.title ?? job.scenarioId;
  return [
    `# Incident ${job.id}: ${title}`,
    `**Outcome:** ${resolved ? "resolved" : "not resolved"} in ${Math.round(durationMs / 1000)} s`,
    `**Detected:** ${alert?.type === "alert" ? alert.data.detail : "n/a"}`,
    `**Actions:**`,
    ...(actions.length ? actions.map((a) => a.type === "agent.tool_call" ? `- ${a.data.tool} ${JSON.stringify(a.data.args)}` : "") : ["- none"]),
  ].join("\n");
}

/** Every minute: if nothing happened for 15 min and the lab runs, put it to sleep. */
export function startIdleSleeper(): void {
  setInterval(async () => {
    if (current || queue.length || Date.now() - lastActivity < config.idleSleepMs) return;
    try {
      // Re-check after the await: an incident may have started meanwhile.
      if ((await labState()) === "running" && !current && !queue.length) {
        await sleepLab();
        console.log("lab idle, put to sleep");
      }
    } catch (e) {
      console.error("idle sleeper", e);
    }
  }, 60_000);
}
