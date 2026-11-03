// The agent's hands. Every call is checked against contracts/tools.ts, shown to viewers as
// tool_call/tool_result events, and runs either here or as the matching lab-<name> document.
// Only names from TOOLS reach runDoc, so lab-scenario and lab-provision are out of reach.

import { LIMITS } from "../../../contracts/api.js";
import { TOOLS, type ToolSpec } from "../../../contracts/tools.js";
import { runDoc } from "./aws.js";
import { emit } from "./bus.js";
import { probe } from "./prober.js";

export interface ToolOutcome {
  ok: boolean;
  output: string;
}

export interface Toolbox {
  call(name: string, args: Record<string, unknown>): Promise<ToolOutcome>;
  readonly steps: number;
  readonly resolution: string | null; // summary passed to resolve, if the agent called it
  close(): void;                      // refuse every later call (incident is being verified)
}

export class StepLimitError extends Error {}

/** Tools that change the lab (everything of kind "action" except resolve). */
export const isFix = (name: string) => TOOLS.some((t) => t.name === name && t.kind === "action" && t.name !== "resolve");

// contracts param name -> SSM document parameter name
const DOC_PARAM: Record<string, string> = { service: "Service", lines: "Lines", release: "Release", path: "Path", pid: "Pid", name: "Name" };

function invalid(spec: ToolSpec, args: Record<string, unknown>): string | null {
  for (const key of Object.keys(args)) if (!Object.hasOwn(spec.params, key)) return `unknown argument "${key}"`;
  for (const [key, p] of Object.entries(spec.params)) {
    const v = args[key];
    if (p.type === "integer") {
      if (!Number.isInteger(v) || (v as number) < p.minimum || (v as number) > p.maximum) return `${key} must be an integer ${p.minimum}-${p.maximum}`;
    } else if ("enum" in p) {
      if (typeof v !== "string" || !p.enum.includes(v)) return `${key} must be one of ${p.enum.join(", ")}`;
    } else if (typeof v !== "string" || !new RegExp(p.pattern).test(v)) {
      return `${key} does not match ${p.pattern}`;
    }
  }
  return null;
}

async function run(spec: ToolSpec, args: Record<string, unknown>): Promise<ToolOutcome> {
  if (spec.name === "check_health") {
    const p = await probe();
    return { ok: true, output: `${p.healthy ? "HEALTHY" : "UNHEALTHY"}: ${p.detail}` };
  }
  if (spec.name === "resolve") return { ok: true, output: "resolution recorded; the oracle will verify" };
  const params = Object.fromEntries(Object.entries(args).map(([k, v]) => [DOC_PARAM[k] ?? k, String(v)]));
  const r = await runDoc(`lab-${spec.name}`, params, 45_000);
  return { ok: r.ok, output: r.output || (r.ok ? "(no output)" : "(failed, no output)") };
}

export function createToolbox(incidentId: string, onFix?: () => void): Toolbox {
  let steps = 0;
  let resolution: string | null = null;
  let callN = 0;
  let closed = false;

  return {
    get steps() { return steps; },
    get resolution() { return resolution; },
    close() { closed = true; },

    async call(name, args) {
      if (closed) throw new Error("incident is closed");
      if (typeof args !== "object" || args === null || Array.isArray(args)) args = {};
      // resolve only reports; it never touches the lab, so it is allowed after the last real step.
      if (name !== "resolve") {
        if (steps >= LIMITS.agentMaxSteps) throw new StepLimitError(`step limit (${LIMITS.agentMaxSteps}) reached`);
        steps++;
      }
      const callId = `${incidentId}-${++callN}`;
      const spec = TOOLS.find((t) => t.name === name);
      emit({ incidentId, type: "agent.tool_call", data: { callId, tool: name, args, explain: spec ? spec.explain(args) : "Trying a tool that does not exist." } });

      const started = Date.now();
      const problem = spec ? invalid(spec, args) : `unknown tool "${name}"`;
      let outcome: ToolOutcome;
      if (problem || !spec) outcome = { ok: false, output: `refused: ${problem}` };
      else {
        if (isFix(spec.name) && !closed) onFix?.();
        try { outcome = await run(spec, args); }
        catch (e) { outcome = { ok: false, output: `error: ${(e as Error).message}` }; }
      }
      if (spec?.name === "resolve" && outcome.ok && !closed) resolution = String(args.summary);
      emit({ incidentId, type: "agent.tool_result", data: { callId, ok: outcome.ok, output: outcome.output, durationMs: Date.now() - started } });
      return outcome;
    },
  };
}
