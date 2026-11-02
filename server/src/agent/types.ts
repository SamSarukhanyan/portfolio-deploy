// What the Control Plane gives an agent and expects back. The agent sees symptoms and tools only.

import type { Usage } from "../../../contracts/events.js";
import type { Toolbox } from "../lab/toolbox.js";

export interface AgentContext {
  alert: string;                      // what the prober saw, e.g. "/ no response"
  tools: Toolbox;                     // the only way to touch the lab
  think(text: string): void;          // shown live as agent.thought
  signal: AbortSignal;                // fires on the incident timeout
}

export interface AgentResult {
  provider: string;
  model: string;
  usage: Usage;
}

export type Agent = (ctx: AgentContext) => Promise<AgentResult>;
