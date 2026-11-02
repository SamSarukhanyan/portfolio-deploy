// Event bus: numbers every event, keeps the last 500 for SSE reconnects, persists incident events.

import type { LabEvent } from "../../../contracts/events.js";
import { appendEvent } from "./store.js";

type Draft = LabEvent extends infer E ? (E extends LabEvent ? Omit<E, "seq" | "ts"> : never) : never;
type Listener = (e: LabEvent) => void;

let seq = 0;
const recent: LabEvent[] = [];
const listeners = new Set<Listener>();

export function emit(draft: Draft): LabEvent {
  const e = { ...draft, seq: ++seq, ts: new Date().toISOString() } as LabEvent;
  recent.push(e);
  if (recent.length > 500) recent.shift();
  appendEvent(e);
  for (const l of listeners) l(e);
  return e;
}

export function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function eventsAfter(lastSeq: number): LabEvent[] {
  return recent.filter((e) => e.seq > lastSeq);
}
