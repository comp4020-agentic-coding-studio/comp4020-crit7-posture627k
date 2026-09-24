import { EventEmitter } from "node:events";

// One process, one bus: every open SSE connection subscribes here, and a
// persisted selection change is broadcast to all of them. This only works
// because the app runs on exactly one machine (see fly.toml) — a second
// machine would have its own bus and clients would miss events.
export const bus = new EventEmitter();
bus.setMaxListeners(0);

// The shape broadcast once a selection change has already been written to
// SQLite (see src/pages/api/selection.ts): which demo course, and whether it
// is now selected. SQLite is authoritative — this event is a courtesy
// notification to other open tabs, never a substitute for reading the
// database, and applying it must be safe to repeat (idempotent).
export interface SelectionChangeEvent {
  courseId: string;
  selected: boolean;
}
