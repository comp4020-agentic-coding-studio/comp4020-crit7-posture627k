import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { selectedActivityOptions, selectedCourses } from "./schema";

// One SQLite file is the app's whole persistent state. In production
// fly.toml points DATABASE_PATH at the machine's volume (/data), which is
// how state survives a reload and a redeploy; locally it defaults to an
// untracked file in .data/.
const path = process.env.DATABASE_PATH ?? "./.data/app.db";
mkdirSync(dirname(path), { recursive: true });

const client = new Database(path);
client.pragma("journal_mode = WAL");

export const db = drizzle(client);

// Migrations run at boot, on whatever machine holds the volume — the
// recommended shape for SQLite on Fly, where there's no separate machine to
// run them from. The flow: edit src/lib/schema.ts, `pnpm db:generate`,
// commit the migration it writes to drizzle/.
migrate(db, { migrationsFolder: "./drizzle" });

// SQLite is authoritative for the selection: the SSE stream only notifies
// other open tabs that a change happened, it never carries the state itself.

export function listSelectedCourseIds(): string[] {
  return db
    .select()
    .from(selectedCourses)
    .all()
    .map((row) => row.courseId);
}

// Idempotent: selecting an already-selected course leaves the table
// unchanged instead of erroring on the primary-key conflict.
export function selectCourse(courseId: string): void {
  db.insert(selectedCourses).values({ courseId }).onConflictDoNothing().run();
}

// Idempotent: removing a course that isn't selected is a no-op delete. Also
// clears any activity-option selections that belonged to it — a removed
// course must leave no timetable trace behind.
export function deselectCourse(courseId: string): void {
  db.transaction((tx) => {
    tx.delete(selectedActivityOptions).where(eq(selectedActivityOptions.courseId, courseId)).run();
    tx.delete(selectedCourses).where(eq(selectedCourses.courseId, courseId)).run();
  });
}

// activityGroupId -> the option id currently chosen for it. An activity
// group absent from this map has no option selected.
export function listSelectedActivityOptions(): Record<string, string> {
  return Object.fromEntries(
    db
      .select()
      .from(selectedActivityOptions)
      .all()
      .map((row) => [row.activityGroupId, row.optionId]),
  );
}

// Sets (or replaces) the chosen option for one activity group.
export function setActivityOption(courseId: string, activityGroupId: string, optionId: string): void {
  db.insert(selectedActivityOptions)
    .values({ activityGroupId, courseId, optionId })
    .onConflictDoUpdate({ target: selectedActivityOptions.activityGroupId, set: { optionId } })
    .run();
}

// Clears the chosen option for one activity group (e.g. unchecking an
// optional activity). A no-op if it had no option selected.
export function clearActivityOption(activityGroupId: string): void {
  db.delete(selectedActivityOptions).where(eq(selectedActivityOptions.activityGroupId, activityGroupId)).run();
}

// Bulk version of setActivityOption for "Fill fixed activities": applies
// every given selection in one transaction so the fill is all-or-nothing.
export function setActivityOptions(
  selections: { courseId: string; activityGroupId: string; optionId: string }[],
): void {
  db.transaction((tx) => {
    for (const { courseId, activityGroupId, optionId } of selections) {
      tx.insert(selectedActivityOptions)
        .values({ activityGroupId, courseId, optionId })
        .onConflictDoUpdate({ target: selectedActivityOptions.activityGroupId, set: { optionId } })
        .run();
    }
  });
}
