import type { APIRoute } from "astro";
import {
  findActivityGroup,
  findActivityOption,
  findDemoCourse,
  singleOptionRequiredGroups,
} from "../../lib/catalogue";
import {
  clearActivityOption,
  listSelectedActivityOptions,
  listSelectedCourseIds,
  setActivityOption,
  setActivityOptions,
} from "../../lib/db";
import { bus, type SelectionChangeEvent } from "../../lib/events";

// The activity-option counterpart to /api/selection: that route only ever
// toggles a whole course in or out, so it has nothing to validate beyond a
// courseId and an add/remove action. Choosing or clearing one activity
// group's time option needs a materially different, three-field shape
// (courseId, activityGroupId, optionId) that must be checked against the
// catalogue at every level — course, then activity group within that
// course, then option within that group — so it gets its own narrowly
// scoped route rather than overloading /api/selection's contract.
export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const action = String(form.get("action") ?? "");

  if (action === "fill-fixed") {
    // Entirely server-computed from the catalogue and the current
    // selection — the client supplies no identifiers here, so there is
    // nothing for it to forge its way into. Only groups that aren't already
    // filled with their single valid option count as newly filled, so the
    // response can honestly report "nothing to do" on a second call instead
    // of silently re-writing rows that already hold the right value.
    const currentOptions = listSelectedActivityOptions();
    const targets = singleOptionRequiredGroups(listSelectedCourseIds());
    const selections = targets
      .filter(({ group }) => currentOptions[group.id] !== group.options[0].id)
      .map(({ courseId, group }) => ({
        courseId,
        activityGroupId: group.id,
        optionId: group.options[0].id,
      }));
    if (selections.length > 0) setActivityOptions(selections);
    for (const selection of selections) {
      const change: SelectionChangeEvent = { kind: "activity", ...selection };
      bus.emit("selection", change);
    }
    return new Response(JSON.stringify({ filled: selections, filledCount: selections.length }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  if (action !== "set" && action !== "clear") {
    return new Response(`action must be "set", "clear", or "fill-fixed", got: ${action}`, {
      status: 400,
    });
  }

  const courseId = String(form.get("courseId") ?? "");
  const activityGroupId = String(form.get("activityGroupId") ?? "");

  if (!findDemoCourse(courseId)) {
    return new Response(`unknown courseId: ${courseId}`, { status: 400 });
  }
  if (!findActivityGroup(courseId, activityGroupId)) {
    return new Response(`unknown activityGroupId: ${activityGroupId} for course ${courseId}`, {
      status: 400,
    });
  }
  if (!listSelectedCourseIds().includes(courseId)) {
    return new Response(`course not selected: ${courseId}`, { status: 400 });
  }

  if (action === "clear") {
    clearActivityOption(activityGroupId);
    const change: SelectionChangeEvent = {
      kind: "activity",
      courseId,
      activityGroupId,
      optionId: null,
    };
    bus.emit("selection", change);
    return new Response(JSON.stringify({ courseId, activityGroupId, optionId: null }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  const optionId = String(form.get("optionId") ?? "");
  if (!findActivityOption(courseId, activityGroupId, optionId)) {
    return new Response(
      `unknown optionId: ${optionId} for ${courseId}/${activityGroupId}`,
      { status: 400 },
    );
  }

  setActivityOption(courseId, activityGroupId, optionId);
  const change: SelectionChangeEvent = { kind: "activity", courseId, activityGroupId, optionId };
  bus.emit("selection", change);

  return new Response(JSON.stringify({ courseId, activityGroupId, optionId }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
