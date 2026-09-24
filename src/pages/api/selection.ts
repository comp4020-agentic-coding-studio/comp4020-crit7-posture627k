import type { APIRoute } from "astro";
import { findDemoCourse } from "../../lib/catalogue";
import { deselectCourse, selectCourse } from "../../lib/db";
import { bus, type SelectionChangeEvent } from "../../lib/events";

// The only mutation route in the app: toggle one demo course in or out of
// the shared selection. courseId and action are validated against the
// controlled catalogue before anything is written, since both come straight
// from the client and neither can be trusted. SQLite is written first; the
// SSE broadcast only ever happens after that write has already succeeded, so
// other tabs are notified of a change that is already durable.
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
    deselectCourse(courseId);
  }

  const change: SelectionChangeEvent = { courseId, selected };
  bus.emit("selection", change);

  return new Response(JSON.stringify(change), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
