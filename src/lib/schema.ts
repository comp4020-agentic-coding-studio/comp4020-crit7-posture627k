import { sqliteTable, text } from "drizzle-orm/sqlite-core";

// The prototype's persisted domain concepts (see src/lib/catalogue.ts for
// the controlled catalogue data these rows point into). There are no user
// accounts in this prototype, so this is one shared planner state. To
// change either table: edit here, run `pnpm db:generate` to turn the diff
// into a migration under drizzle/, and commit both — the migration applies
// automatically when the server boots (see src/lib/db.ts). Never edit the
// database by hand.

// A row's presence means that course id is selected; there is nothing else
// to store about the course itself, since the catalogue is authoritative
// for everything about it.
export const selectedCourses = sqliteTable("selected_courses", {
  courseId: text("course_id").primaryKey(),
});

export type SelectedCourse = typeof selectedCourses.$inferSelect;

// Which time option is currently chosen for an activity group (e.g. one of
// a course's Tutorial choices). One row per activity group that currently
// has a choice made — an activity group with no row has no option selected
// yet. courseId is stored alongside activityGroupId (rather than derived
// from it) so a course's rows can be deleted in one query when the course
// itself is removed, without depending on the shape of catalogue ids.
export const selectedActivityOptions = sqliteTable("selected_activity_options", {
  activityGroupId: text("activity_group_id").primaryKey(),
  courseId: text("course_id").notNull(),
  optionId: text("option_id").notNull(),
});

export type SelectedActivityOption = typeof selectedActivityOptions.$inferSelect;
