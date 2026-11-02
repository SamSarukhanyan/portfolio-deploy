// Incident Lab Control Plane: HTTP/SSE API, live metrics while the lab is awake, idle sleeper.

import type { Metrics } from "../../../contracts/events.js";
import { labState, runDoc } from "./aws.js";
import { emit } from "./bus.js";
import { config } from "./config.js";
import { createApp } from "./http.js";
import { labStatus, startIdleSleeper } from "./incidents.js";
import { probe, toMetrics } from "./prober.js";

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
