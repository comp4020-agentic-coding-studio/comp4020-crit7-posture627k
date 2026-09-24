import { sqliteTable, text } from "drizzle-orm/sqlite-core";

// The prototype's only persisted domain concept: which demo courses (see
// src/lib/catalogue.ts for the catalogue itself) are currently selected.
// There are no user accounts in this prototype, so this is one shared
// planner selection: a row's presence means that course id is selected, and
// there is nothing else to store. To change it: edit here, run
// `pnpm db:generate` to turn the diff into a migration under drizzle/, and
// commit both — the migration applies automatically when the server boots
// (see src/lib/db.ts). Never edit the database by hand.
export const selectedCourses = sqliteTable("selected_courses", {
  courseId: text("course_id").primaryKey(),
});

export type SelectedCourse = typeof selectedCourses.$inferSelect;
