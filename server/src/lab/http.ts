// HTTP API from contracts/api.ts. Runs behind nginx, which forwards the client IP.

import express from "express";
import type { LabStatusResponse } from "../../../contracts/api.js";
import type { Metrics } from "../../../contracts/events.js";
import { SCENARIOS } from "../../../contracts/scenarios.js";
import { eventsAfter, subscribe } from "./bus.js";
import { agentOnline, createIncident, labStatus, remainingToday } from "./incidents.js";
import { listSummaries, loadIncident } from "./store.js";

const MAX_STREAMS = 200;
let streams = 0;

export function createApp(getMetrics: () => Metrics | null): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", "loopback");
  app.use(express.json({ limit: "2kb" }));

  app.get("/api/scenarios", (_req, res) => {
    res.json(SCENARIOS);
  });

  app.get("/api/lab/status", (_req, res) => {
    const body: LabStatusResponse = { ...labStatus(), agentOnline: agentOnline(), remainingToday: remainingToday(), metrics: getMetrics() };
    res.json(body);
  });

  app.post("/api/incidents", (req, res) => {
    const scenario = typeof req.body?.scenario === "string" ? req.body.scenario : "";
    const r = createIncident(scenario, req.ip ?? "unknown");
    if ("incidentId" in r) return void res.status(202).json(r);
    if ("retryAfterSec" in r) return void res.status(429).set("Retry-After", String(r.retryAfterSec)).json(r);
    if (r.error === "agent_offline") return void res.status(503).json(r);
    res.status(400).json(r);
  });

  app.get("/api/incidents", (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const before = typeof req.query.before === "string" ? req.query.before : undefined;
    res.json(listSummaries(limit, before));
  });

  app.get("/api/incidents/:id", (req, res) => {
    const incident = loadIncident(req.params.id);
    if (!incident) return void res.status(404).json({ error: "not_found" });
    res.json(incident);
  });

  app.get("/api/events", (req, res) => {
    if (streams >= MAX_STREAMS) return void res.status(503).json({ error: "too_many_viewers" });
    streams++;
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // nginx: stream, don't buffer
    });
    const send = (e: { seq: number; type: string }) => res.write(`id: ${e.seq}\nevent: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`);
    // Reconnect: resend what was missed. First visit: replay the incident in progress, if any.
    const last = Number(req.get("Last-Event-ID") ?? req.query.after);
    const running = labStatus().currentIncidentId;
    if (Number.isFinite(last) && last > 0) eventsAfter(last).forEach(send);
    else if (running) eventsAfter(0).filter((e) => e.incidentId === running && e.type !== "metrics").forEach(send);
    const unsubscribe = subscribe(send);
    const ping = setInterval(() => res.write(": ping\n\n"), 15_000);
    req.on("close", () => {
      streams--;
      clearInterval(ping);
      unsubscribe();
    });
  });

  return app;
}
