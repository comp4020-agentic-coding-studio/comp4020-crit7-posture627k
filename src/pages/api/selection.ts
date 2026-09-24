import type { APIRoute } from "astro";
import { findDemoCourse } from "../../lib/catalogue";
import { deselectCourse, selectCourse } from "../../lib/db";
import { bus, type SelectionChangeEvent } from "../../lib/events";

// The only course-level mutation route in the app: toggle one demo course in
// or out of the shared selection. courseId and action are validated against
// the controlled catalogue before anything is written, since both come
// straight from the client and neither can be trusted. SQLite is written
// first; the SSE broadcast only ever happens after that write has already
// succeeded, so other tabs are notified of a change that is already durable.
//
// Adding a course only ever selects the course itself — it never persists
// any activity option, fixed or otherwise. That's a deliberate, separate
// user action: multi-option activities are chosen by hand, and single-option
// required ("fixed") activities are persisted only by explicitly pressing
// "Fill fixed activities" (src/pages/api/activity-selection.ts). Auto-filling
// them here made that button look broken in production — by the time a user
// pressed it, the same request had usually already done the work silently.
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
  if (selected) {
    selectCourse(courseId);
  } else {
    // Cascades: every activity-option selection for this course goes too.
    deselectCourse(courseId);
  }

  const change: SelectionChangeEvent = { kind: "course", courseId, selected };
  bus.emit("selection", change);

  return new Response(JSON.stringify({ courseId, selected }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
