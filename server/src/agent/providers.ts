// ModelProvider implementations (contracts/provider.ts): Claude for the public site, Ollama for
// free local development. Each session appends to its own native history and never rewrites it.

import Anthropic from "@anthropic-ai/sdk";
import type { Usage } from "../../../contracts/events.js";
import type { ModelProvider, ModelResponse, SessionInput, ToolCall } from "../../../contracts/provider.js";
import type { ToolSpec } from "../../../contracts/tools.js";

function jsonSchema(t: ToolSpec) {
  return {
    type: "object" as const,
    properties: Object.fromEntries(Object.entries(t.params).map(([k, p]) => [k, { ...p }])),
    required: Object.keys(t.params),
    additionalProperties: false,
  };
}

// ---------- Claude ----------

export function claudeProvider(model = process.env.CLAUDE_MODEL ?? "claude-haiku-5-5"): ModelProvider {
  const client = new Anthropic(); // ANTHROPIC_API_KEY from the environment
  return {
    name: "claude",
    model,
    start(system, specs) {
      const tools: Anthropic.Tool[] = specs.map((t) => ({ name: t.name, description: t.description, input_schema: jsonSchema(t) }));
      const messages: Anthropic.MessageParam[] = [];

      return {
        async next(input: SessionInput, signal): Promise<ModelResponse> {
          messages.push({
            role: "user",
            content: "text" in input
              ? input.text
              : input.results.map((r) => ({ type: "tool_result" as const, tool_use_id: r.callId, content: r.output, is_error: r.isError })),
          });
          const res = await client.messages.create({
            model,
            max_tokens: 4096,
            system,
            tools,
            messages,
            output_config: { effort: "low" }, // routine diagnosis; fewer, more decisive steps
            cache_control: { type: "ephemeral" }, // caches the growing prefix across the loop
          }, { signal });
          messages.push({ role: "assistant", content: res.content }); // unchanged, thinking blocks included

          const toolCalls: ToolCall[] = res.content
            .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
            .map((b) => ({ id: b.id, name: b.name, args: (b.input ?? {}) as Record<string, unknown> }));
          const text = res.stop_reason === "refusal"
            ? "I can't continue with this request."
            : res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n");
          const usage: Usage = {
            inputTokens: res.usage.input_tokens + (res.usage.cache_creation_input_tokens ?? 0),
            outputTokens: res.usage.output_tokens,
            cacheReadTokens: res.usage.cache_read_input_tokens ?? 0,
          };
          return { text, toolCalls: res.stop_reason === "refusal" ? [] : toolCalls, usage };
        },
      };
    },
  };
}

// ---------- Ollama ----------

interface OllamaMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: { function: { name: string; arguments: Record<string, unknown> | string } }[];
  tool_name?: string;
}

export function ollamaProvider(
  model = process.env.OLLAMA_MODEL ?? "gemma4:e4b",
  url = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434",
): ModelProvider {
  return {
    name: "ollama",
    model,
    start(system, specs) {
      const tools = specs.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: jsonSchema(t) } }));
      const messages: OllamaMessage[] = [{ role: "system", content: system }];
      let pending: ToolCall[] = []; // calls of the last response, to name the tool results

      return {
        async next(input: SessionInput, signal): Promise<ModelResponse> {
          if ("text" in input) messages.push({ role: "user", content: input.text });
          else for (const r of input.results) {
            messages.push({ role: "tool", content: r.output, tool_name: pending.find((c) => c.id === r.callId)?.name ?? "" });
          }

          // Small local models sometimes return nothing at all (often a tool call the runtime
          // could not parse). Nothing is appended then, so simply ask again, up to 3 times.
          let body: { message: OllamaMessage; prompt_eval_count?: number; eval_count?: number };
          let attempt = 0;
          do {
            const res = await fetch(`${url}/api/chat`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ model, messages, tools, stream: false, think: false, options: { num_ctx: 8192 }, keep_alive: "30m" }),
              signal,
            });
            if (!res.ok) throw new Error(`ollama ${res.status}: ${await res.text()}`);
            body = (await res.json()) as typeof body;
          } while (!body.message.content?.trim() && !body.message.tool_calls?.length && ++attempt < 3);
          messages.push(body.message);

          pending = (body.message.tool_calls ?? []).slice(0, 1).map((c, i) => ({ // one call at a time
            id: `call-${messages.length}-${i}`,
            name: c.function.name,
            args: typeof c.function.arguments === "string" ? safeJson(c.function.arguments) : c.function.arguments ?? {},
          }));
          if (body.message.tool_calls && body.message.tool_calls.length > 1) body.message.tool_calls = body.message.tool_calls.slice(0, 1);
          return {
            text: body.message.content ?? "",
            toolCalls: pending,
            usage: { inputTokens: body.prompt_eval_count ?? 0, outputTokens: body.eval_count ?? 0, cacheReadTokens: 0 },
          };
        },
      };
    },
  };
}

function safeJson(s: string): Record<string, unknown> {
  try {
    const v = JSON.parse(s) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
