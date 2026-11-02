// The only seam between the agent and a model. AI_PROVIDER (env AGENT) picks the implementation:
//   claude -> Claude Haiku 5.5 via the Claude API (production)
//   ollama -> local model via http://127.0.0.1:11434 (development)
// A session keeps the conversation in the provider's own format and only ever appends to it:
// Claude ties its thinking blocks to the exact history, so a provider must not rebuild it.

import type { Usage } from "./events.js";
import type { ToolSpec } from "./tools.js";

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  callId: string;
  output: string;
  isError: boolean;
}

/** First call: the incident briefing. After that: one result per tool call of the previous response, in order. */
export type SessionInput = { text: string } | { results: ToolResult[]; note?: string };

export interface ModelResponse {
  text: string;                // shown as agent.thought when non-empty
  toolCalls: ToolCall[];       // empty = the model answered in text only
  usage: Usage;
}

export interface ModelSession {
  next(input: SessionInput, signal: AbortSignal): Promise<ModelResponse>;
}

export interface ModelProvider {
  readonly name: "claude" | "ollama";
  readonly model: string;
  /** system must be stable (no timestamps): it is the cached prefix. tools keep their order. */
  start(system: string, tools: readonly ToolSpec[]): ModelSession;
}
