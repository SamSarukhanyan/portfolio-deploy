// The real on-call agent: a model drives the toolbox until it resolves, gives up, or runs out
// of steps/time. Works with any ModelProvider (contracts/provider.ts).

import type { Lang } from "../../../contracts/api.js";
import type { Usage } from "../../../contracts/events.js";
import type { ModelProvider, SessionInput, ToolResult } from "../../../contracts/provider.js";
import { TOOLS } from "../../../contracts/tools.js";
import { StepLimitError } from "../lab/toolbox.js";
import type { Agent } from "./types.js";

// Stable on purpose: it is the cached prefix. No dates, ids or per-incident text here.
export const SYSTEM_PROMPT = `You are the on-call SRE for a small website called "the lab". An alert just fired. Find the root cause with the tools, fix it with the smallest safe action, confirm the fix with check_health, then call resolve.

The lab: nginx serves the site from /var/www/lab/current (a symlink to one of /var/www/lab/releases/<sha>) and proxies /api to a small Python app (service "app"). Scratch and cache files live under /var/lab, which is a small separate disk. Deploys and config edits are logged and shown by recent_changes.

How to work:
- Before every tool call, write one short sentence in plain English that a non-technical viewer understands: what you are checking or doing, and why. No jargon without a short explanation.
- Look before you change anything. Form a hypothesis from the evidence, then act on it.
- Prefer reversible fixes: restart a service, roll back a release, restore a known-good config, delete a junk file, stop a runaway process.
- Start from the symptom: what fails, then which component behind it. Check recent_changes when the symptom could come from a change, and treat a change as the cause only if it happened minutes before the alert, not hours or days. If so, undo it first: roll back to the release before it, or restore the known-good config.
- Every reply must contain exactly one tool call until you have called resolve. Never stop with only a plan in words: if you say you will do something, call the tool in the same reply.
- You have at most 10 tool calls in total, so do not repeat checks without a reason.
- Call resolve only after check_health reports HEALTHY. The summary says the root cause and the fix in one or two sentences.
- If a tool is refused or fails, read the message and adjust; do not retry the same call unchanged.`;

// Per incident, so it goes into the first message, never the cached system prompt.
const LANGUAGE_NOTE: Record<Lang, string> = {
  en: "",
  ru: "\nThe viewer reads Russian: write every plain-language note and the resolve summary in Russian. Keep tool names, commands, file paths, service names, release ids and log text exactly as they are.",
  hy: "\nThe viewer reads Armenian: write every plain-language note and the resolve summary in Armenian. Keep tool names, commands, file paths, service names, release ids and log text exactly as they are.",
};

const add = (a: Usage, b: Usage): Usage => ({
  inputTokens: a.inputTokens + b.inputTokens,
  outputTokens: a.outputTokens + b.outputTokens,
  cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
});

export function llmAgent(provider: ModelProvider): Agent {
  return async ({ alert, lang, tools, think, signal }) => {
    let usage: Usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 };
    const session = provider.start(SYSTEM_PROMPT, TOOLS);
    // The time goes here, not in the system prompt, so the cached prefix stays identical.
    let input: SessionInput = { text: `ALERT from monitoring at ${new Date().toISOString()}: ${alert}\nInvestigate and fix it.${LANGUAGE_NOTE[lang]}` };
    let nudges = 0;
    let healthy = false;     // last check_health said HEALTHY
    let lastThought = "";

    try {
      while (!signal.aborted) {
        const r = await session.next(input, signal);
        usage = add(usage, r.usage);
        if (r.text.trim()) think((lastThought = r.text.trim()));

        if (r.toolCalls.length === 0) {
          if (tools.resolution) break;
          if (++nudges > 2) {
            // Small models often announce "I will now resolve" and stop. If the site is verified
            // healthy, close it on their behalf with their own words; the oracle still checks.
            if (healthy) await tools.call("resolve", { summary: (lastThought || "The site is healthy again.").slice(0, 480).padEnd(10, ".") });
            break;
          }
          input = { text: healthy
            ? "check_health reports HEALTHY. Call resolve now with a one or two sentence summary of the root cause and the fix."
            : "You replied without a tool call. Call the next tool now." };
          continue;
        }

        const results: ToolResult[] = [];
        let resolved = false;
        for (const call of r.toolCalls) {
          const out = await tools.call(call.name, call.args);
          results.push({ callId: call.id, output: out.output, isError: !out.ok });
          if (call.name === "check_health") healthy = out.output.startsWith("HEALTHY");
          if (call.name === "resolve" && out.ok) resolved = true;
        }
        if (resolved) break;
        input = { results };
      }
    } catch (e) {
      if (!(e instanceof StepLimitError) && !signal.aborted) throw e;
    }
    return { provider: provider.name, model: provider.model, usage };
  };
}
