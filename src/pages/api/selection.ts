import type { APIRoute } from "astro";
import { findDemoCourse, singleOptionRequiredGroups } from "../../lib/catalogue";
import { deselectCourse, selectCourse, setActivityOptions } from "../../lib/db";
import { bus, type SelectionChangeEvent } from "../../lib/events";

// The only course-level mutation route in the app: toggle one demo course in
// or out of the shared selection. courseId and action are validated against
// the controlled catalogue before anything is written, since both come
// straight from the client and neither can be trusted. SQLite is written
// first; the SSE broadcast only ever happens after that write has already
// succeeded, so other tabs are notified of a change that is already durable.
export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const courseId = String(form.get("courseId") ?? "");
  const action = String(form.get("action") ?? "");

  if (!findDemoCourse(courseId)) {
    return new Response(`unknown courseId: ${courseId}`, { status: 400 });
  }
  if (action !== "add" && action !== "remove") {
    return new Response(`action must be "add" or "remove", got: ${action}`, {
      status: 400,
    });
  }

  const selected = action === "add";
  const filled: { courseId: string; activityGroupId: string; optionId: string }[] = [];

  if (selected) {
    selectCourse(courseId);
    // A required activity with only one time option has nothing meaningful
    // to choose, so it's part of the course's timetable as soon as the
    // course is: fill it in the same request, before anything is broadcast.
    for (const { group } of singleOptionRequiredGroups([courseId])) {
      filled.push({ courseId, activityGroupId: group.id, optionId: group.options[0].id });
    }
    if (filled.length > 0) setActivityOptions(filled);
  } else {
    // Cascades: every activity-option selection for this course goes too.
    deselectCourse(courseId);
  }

  const change: SelectionChangeEvent = { kind: "course", courseId, selected };
  bus.emit("selection", change);
  for (const fill of filled) {
    bus.emit("selection", { kind: "activity", ...fill } satisfies SelectionChangeEvent);
  }

  // The response body stays exactly {courseId, selected} — no `kind` — so
  // it remains backward-compatible with existing callers of this route.
  return new Response(JSON.stringify({ courseId, selected }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
