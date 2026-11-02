// The only seam between the agent and a model. AI_PROVIDER picks the implementation:
//   claude -> Claude Haiku 5.5 via the Claude API (production)
//   ollama -> local model via http://127.0.0.1:11434 (development)

import type { Usage } from "./events.js";
import type { ToolSpec } from "./tools.js";

export type Turn =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; toolCalls: ToolCall[] }
  | { role: "tool"; callId: string; output: string; isError: boolean };

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ModelRequest {
  system: string;              // stable across an incident (cache-friendly: never put timestamps here)
  tools: readonly ToolSpec[];  // same order every request
  turns: Turn[];               // append-only within an incident
}

export interface ModelResponse {
  text: string;                // shown as agent.thought when non-empty
  toolCalls: ToolCall[];       // empty = model answered in text only
  usage: Usage;
}

export interface ModelProvider {
  readonly name: "claude" | "ollama";
  readonly model: string;
  next(req: ModelRequest, signal: AbortSignal): Promise<ModelResponse>;
}
