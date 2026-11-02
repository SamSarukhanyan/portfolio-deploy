# Contracts

The source of truth every role builds against (see `docs/ai-oncall/PLAN.md`). Change a
contract only through the Tech Lead, then update both sides in the same change.

| File | Defines | Used by |
|---|---|---|
| `events.ts` | SSE event stream, incident statuses, metrics | backend, frontend, agent |
| `api.ts` | HTTP routes, request/response shapes, limits | backend, frontend |
| `tools.ts` | agent tool allowlist, parameter patterns, viewer explanations | agent, infra (SSM docs), backend |
| `provider.ts` | `ModelProvider` seam (`claude` / `ollama`) | agent |
| `scenarios.ts`, `scenarios.md` | failure scenarios and their break / oracle / reset scripts | chaos, backend, frontend |

These are type-only TypeScript files plus constants: no runtime code beyond data.
