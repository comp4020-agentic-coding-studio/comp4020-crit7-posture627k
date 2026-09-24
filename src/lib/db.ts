import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { selectedCourses } from "./schema";

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

// Idempotent: removing a course that isn't selected is a no-op delete.
export function deselectCourse(courseId: string): void {
  db.delete(selectedCourses).where(eq(selectedCourses.courseId, courseId)).run();
}
