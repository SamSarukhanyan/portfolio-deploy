// Incident Lab Control Plane: HTTP/SSE API, live metrics while the lab is awake, idle sleeper.

import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import type { Metrics } from "../../../contracts/events.js";

// In production the Claude API key is a SecureString in SSM Parameter Store, never a file on disk.
// Load it before the modules that build the model client.
const keyParam = process.env.ANTHROPIC_API_KEY_PARAM;
if (keyParam && !process.env.ANTHROPIC_API_KEY) {
  const out = await new SSMClient({}).send(new GetParameterCommand({ Name: keyParam, WithDecryption: true }));
  if (!out.Parameter?.Value) throw new Error(`${keyParam} is empty`);
  process.env.ANTHROPIC_API_KEY = out.Parameter.Value;
}

const { labState, runDoc } = await import("./aws.js");
const { emit } = await import("./bus.js");
const { config } = await import("./config.js");
const { createApp } = await import("./http.js");
const { labStatus, startIdleSleeper } = await import("./incidents.js");
const { probe, toMetrics } = await import("./prober.js");

let metrics: Metrics | null = null;
let usage = { cpuPct: 0, diskPct: 0 };
let tick = 0;

/** Every 5 s while the lab runs: probe it; every 15 s also read CPU and disk over SSM. */
async function sample(): Promise<void> {
  if ((await labState()) !== "running") {
    metrics = null;
    return;
  }
  if (tick++ % 3 === 0) {
    const m = await runDoc("lab-get_metrics", {}, 20_000);
    usage = {
      cpuPct: Number(/cpu_pct=(\d+)/.exec(m.output)?.[1] ?? usage.cpuPct),
      diskPct: Number(/lab_disk_pct=(\d+)/.exec(m.output)?.[1] ?? usage.diskPct),
    };
  }
  metrics = toMetrics(await probe(), usage.cpuPct, usage.diskPct);
  emit({ incidentId: labStatus().currentIncidentId, type: "metrics", data: metrics }); // in the replay too
}

async function loop(): Promise<void> {
  for (;;) {
    await sample().catch((e) => console.error("metrics", (e as Error).message));
    await new Promise((r) => setTimeout(r, 5000));
  }
}

createApp(() => metrics).listen(config.port, "127.0.0.1", () => {
  console.log(`incident lab control plane on 127.0.0.1:${config.port}, agent=${config.agent}, lab=${config.labUrl}`);
  emit({ incidentId: null, type: "agent.presence", data: { online: true } });
});
void loop();
startIdleSleeper();
