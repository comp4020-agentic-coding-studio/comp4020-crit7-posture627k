import { EventEmitter } from "node:events";

// One process, one bus: every open SSE connection subscribes here, and a
// persisted selection change is broadcast to all of them. This only works
// because the app runs on exactly one machine (see fly.toml) — a second
// machine would have its own bus and clients would miss events.
export const bus = new EventEmitter();
bus.setMaxListeners(0);

// The shapes broadcast once a change has already been written to SQLite
// (see src/pages/api/selection.ts and src/pages/api/activity-selection.ts).
// SQLite is authoritative — this event is a courtesy notification to other
// open tabs, never a substitute for reading the database, and applying it
// must be safe to repeat (idempotent). One discriminated union, not
// separate ad-hoc event formats, so every SSE consumer branches on `kind`.
export interface CourseSelectionChangeEvent {
  kind: "course";
  courseId: string;
  selected: boolean;
}

export interface ActivityOptionChangeEvent {
  kind: "activity";
  courseId: string;
  activityGroupId: string;
  // null means the activity group's option was cleared, not set.
  optionId: string | null;
}

export type SelectionChangeEvent = CourseSelectionChangeEvent | ActivityOptionChangeEvent;
