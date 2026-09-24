import { JSDOM } from "jsdom";
import { describe, expect, inject, it } from "vitest";
import { DEMO_CATALOGUE, findDemoCourse } from "../src/lib/catalogue";

// Drives the running app over HTTP (spec/global-setup.ts boots the built
// server against a throwaway SQLite file) to prove the timetable planner's
// contract holds in THIS repo: a demo course can be added and removed
// through the real /api/selection endpoint, the change is visible in the
// server-rendered catalogue on a fresh page load (SQLite, not the response
// body, is what's being checked), and other open tabs would hear about it
// over the same SSE stream the guestbook starter used. Adding a course only
// selects it — it does not by itself persist any activity option, so these
// course-level tests check the catalogue's own selected state rather than a
// timetable block; the activity-choices tests below cover blocks.
const baseUrl = inject("baseUrl");
const courseId = DEMO_CATALOGUE[0].id;

// Astro checks form-like POSTs carry a same-origin Origin header (CSRF
// protection); browsers send it automatically, a bare fetch doesn't.
const postSelection = (body: URLSearchParams) =>
  fetch(new URL("/api/selection", baseUrl), {
    method: "POST",
    headers: { origin: baseUrl },
    body,
  });

const select = (id: string, action: "add" | "remove") =>
  postSelection(new URLSearchParams({ courseId: id, action }));

const getIndexDocument = async (): Promise<Document> => {
  const res = await fetch(baseUrl);
  return new JSDOM(await res.text()).window.document;
};

function isRenderedAsSelected(doc: Document, id: string): boolean {
  const button = doc.querySelector(`button[data-course-id="${id}"]`);
  return button?.getAttribute("aria-pressed") === "true" && button.textContent?.trim() === "Remove";
}

describe("timetable", () => {
  it("exposes course selection and the timetable on the same page", async () => {
    const doc = await getIndexDocument();
    expect(doc.querySelector("#catalogue-list")).toBeTruthy();
    expect(doc.querySelector("#timetable")).toBeTruthy();
  });

  it("rejects a courseId that isn't in the demo catalogue", async () => {
    const res = await select("DEMO9999", "add");
    expect(res.status).toBe(400);
  });

  it("adds a known demo course through the real endpoint", async () => {
    const res = await select(courseId, "add");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ courseId, selected: true });
  });

  it("a fresh GET / after add reflects the added course in the rendered timetable", async () => {
    const doc = await getIndexDocument();
    expect(isRenderedAsSelected(doc, courseId)).toBe(true);
  });

  it("the same course can be removed", async () => {
    const res = await select(courseId, "remove");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ courseId, selected: false });
  });

  it("a fresh GET / after removal no longer reflects it", async () => {
    const doc = await getIndexDocument();
    expect(isRenderedAsSelected(doc, courseId)).toBe(false);
  });

  it("SQLite-backed selection survives independent requests", async () => {
    await select(courseId, "add");
    const first = await getIndexDocument();
    expect(isRenderedAsSelected(first, courseId)).toBe(true);
    const second = await getIndexDocument();
    expect(isRenderedAsSelected(second, courseId)).toBe(true);
    await select(courseId, "remove"); // leave the shared test DB clean
  });

  it("/api/events responds text/event-stream and begins streaming", async () => {
    const stream = await fetch(new URL("/api/events", baseUrl));
    expect(stream.headers.get("content-type")).toContain("text/event-stream");
    const reader = stream.body?.getReader();
    if (!reader) throw new Error("no response body");
    const { value, done } = await reader.read();
    expect(done).toBe(false);
    expect(new TextDecoder().decode(value)).toContain(":");
    await reader.cancel();
  });

  it("a successful mutation produces an SSE selection-change event", async () => {
    const stream = await fetch(new URL("/api/events", baseUrl));
    expect(stream.headers.get("content-type")).toContain("text/event-stream");
    const reader = stream.body?.getReader();
    if (!reader) throw new Error("no response body");

    await select(courseId, "add");

    const decoder = new TextDecoder();
    let received = "";
    while (!received.includes(courseId)) {
      const { value, done } = await reader.read();
      if (done) throw new Error("stream ended before the event arrived");
      received += decoder.decode(value, { stream: true });
    }
    await reader.cancel();
    expect(received).toContain("data: ");
    expect(received).toContain(`"courseId":"${courseId}"`);
    expect(received).toContain(`"selected":true`);

    await select(courseId, "remove"); // leave the shared test DB clean
  }, 10_000);
});

// Second iteration: activity types (Lecture/Tutorial/Lab/Drop-in), required
// vs optional, overlap policy, and per-activity time choices — added on top
// of the course-level contract above, through the same same-page workflow.
// A course id is picked per scenario below to avoid colliding with the
// course-level tests above, which run in this same file against the same
// shared test database.
const postActivitySelection = (body: URLSearchParams) =>
  fetch(new URL("/api/activity-selection", baseUrl), {
    method: "POST",
    headers: { origin: baseUrl },
    body,
  });

const setOption = (courseId: string, activityGroupId: string, optionId: string) =>
  postActivitySelection(new URLSearchParams({ action: "set", courseId, activityGroupId, optionId }));

const clearOption = (courseId: string, activityGroupId: string) =>
  postActivitySelection(new URLSearchParams({ action: "clear", courseId, activityGroupId }));

const fillFixed = () => postActivitySelection(new URLSearchParams({ action: "fill-fixed" }));

function blocksFor(doc: Document, courseId: string): Element[] {
  return Array.from(doc.querySelectorAll(`.block[data-course-id="${courseId}"]`));
}

describe("activity choices", () => {
  // (1) an unselected course produces no timetable activity blocks
  it("an unselected course renders no timetable activity blocks", async () => {
    const doc = await getIndexDocument();
    expect(blocksFor(doc, "DEMO1003")).toHaveLength(0);
  });

  // (2) selecting a course does NOT auto-persist its fixed (single-option
  // required) activity — only "Fill fixed activities" does that, as its own
  // explicit user action. Also covers: a fresh GET / before the fill shows
  // nothing, fill-fixed persists the activity, a fresh GET / after the fill
  // shows it, and fill-fixed reports a meaningful newly-filled count.
  it("selecting a course leaves its fixed activity unfilled until Fill fixed activities is invoked", async () => {
    await select("DEMO1003", "add");
    const beforeFill = await getIndexDocument();
    expect(blocksFor(beforeFill, "DEMO1003")).toHaveLength(0);

    const fillRes = await fillFixed();
    expect(fillRes.status).toBe(200);
    expect((await fillRes.json()).filledCount).toBe(1);

    const afterFill = await getIndexDocument();
    const blocks = blocksFor(afterFill, "DEMO1003");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].getAttribute("data-activity-group-id")).toBe("DEMO1003:LEC");

    await select("DEMO1003", "remove"); // leave the shared test DB clean
  });

  // (2b) a second Fill fixed activities call is idempotent: nothing left to
  // fill, no duplicate row, and the response says so.
  it('"Fill fixed activities" is idempotent once everything is already filled', async () => {
    await select("DEMO1003", "add");
    await fillFixed();

    const secondRes = await fillFixed();
    expect(secondRes.status).toBe(200);
    expect((await secondRes.json()).filledCount).toBe(0);

    const doc = await getIndexDocument();
    expect(blocksFor(doc, "DEMO1003")).toHaveLength(1);

    await select("DEMO1003", "remove"); // leave the shared test DB clean
  });

  // (2c) an optional activity is never auto-filled, even when it has only
  // one option — "fixed" only ever applies to required activities.
  it('"Fill fixed activities" never fills an optional activity, even with a single option', async () => {
    await select("DEMO1004", "add"); // DEMO1004:DRP is optional with exactly one option
    await fillFixed();

    const doc = await getIndexDocument();
    expect(doc.querySelector('.block[data-activity-group-id="DEMO1004:DRP"]')).toBeNull();
    expect(doc.querySelector('.block[data-activity-group-id="DEMO1004:LEC"]')).not.toBeNull();

    await select("DEMO1004", "remove"); // leave the shared test DB clean
  });

  // (3) removing a course removes all of its timetable activities, including
  // both a manually-chosen multi-option activity and one persisted only via
  // "Fill fixed activities" — removal must cascade over both origins.
  it("removing a course removes every one of its timetable activities", async () => {
    await select("DEMO1003", "add");
    await setOption("DEMO1003", "DEMO1003:LAB", "DEMO1003:LAB:1");
    await fillFixed(); // persists DEMO1003:LEC
    const before = await getIndexDocument();
    const groupsBefore = new Set(
      blocksFor(before, "DEMO1003").map((b) => b.getAttribute("data-activity-group-id")),
    );
    expect(groupsBefore).toEqual(new Set(["DEMO1003:LEC", "DEMO1003:LAB"]));

    await select("DEMO1003", "remove");
    const after = await getIndexDocument();
    expect(blocksFor(after, "DEMO1003")).toHaveLength(0);
  });

  // (4) a course can expose Lecture/Tutorial/Lab/Drop-in activity types
  it("the catalogue covers all four activity types", () => {
    const types = new Set(DEMO_CATALOGUE.flatMap((course) => course.activities.map((group) => group.type)));
    expect(types).toEqual(new Set(["Lecture", "Tutorial", "Lab", "Drop-in"]));
  });

  // (5) one activity may have multiple valid time options
  it("some activity groups offer more than one time option", () => {
    const multiOption = DEMO_CATALOGUE.flatMap((course) => course.activities).filter(
      (group) => group.options.length > 1,
    );
    expect(multiOption.length).toBeGreaterThan(0);
  });

  // (6) choosing one option renders that option and not the alternatives
  it("choosing one option out of several renders only that option", async () => {
    await select("DEMO1001", "add");
    await setOption("DEMO1001", "DEMO1001:TUT", "DEMO1001:TUT:1");

    const doc = await getIndexDocument();
    const tutBlocks = doc.querySelectorAll('.block[data-activity-group-id="DEMO1001:TUT"]');
    expect(tutBlocks).toHaveLength(1);
    expect(tutBlocks[0].getAttribute("data-option-id")).toBe("DEMO1001:TUT:1");

    await select("DEMO1001", "remove"); // leave the shared test DB clean
  });

  // (7) changing the option removes the previous block and renders the new one
  it("changing the chosen option swaps the rendered block", async () => {
    await select("DEMO1001", "add");
    await setOption("DEMO1001", "DEMO1001:TUT", "DEMO1001:TUT:1");
    await setOption("DEMO1001", "DEMO1001:TUT", "DEMO1001:TUT:2");

    const doc = await getIndexDocument();
    const tutBlocks = doc.querySelectorAll('.block[data-activity-group-id="DEMO1001:TUT"]');
    expect(tutBlocks).toHaveLength(1);
    expect(tutBlocks[0].getAttribute("data-option-id")).toBe("DEMO1001:TUT:2");

    await select("DEMO1001", "remove"); // leave the shared test DB clean
  });

  // (8) a selected activity option survives a fresh page request/reload
  it("a chosen activity option survives independent requests", async () => {
    await select("DEMO1001", "add");
    await setOption("DEMO1001", "DEMO1001:TUT", "DEMO1001:TUT:3");

    const first = await getIndexDocument();
    const second = await getIndexDocument();
    for (const doc of [first, second]) {
      const tutBlock = doc.querySelector('.block[data-activity-group-id="DEMO1001:TUT"]');
      expect(tutBlock?.getAttribute("data-option-id")).toBe("DEMO1001:TUT:3");
    }

    await select("DEMO1001", "remove"); // leave the shared test DB clean
  });

  // (9) fixed/single-option required activities can be filled, including
  // after being explicitly cleared
  it('"Fill fixed activities" restores a cleared single-option required activity', async () => {
    await select("DEMO1006", "add"); // both DEMO1006 activities are single-option required
    await fillFixed();
    await clearOption("DEMO1006", "DEMO1006:LEC");

    const cleared = await getIndexDocument();
    expect(blocksFor(cleared, "DEMO1006").some((b) => b.getAttribute("data-activity-group-id") === "DEMO1006:LEC")).toBe(
      false,
    );

    const fillRes = await fillFixed();
    expect(fillRes.status).toBe(200);

    const refilled = await getIndexDocument();
    expect(
      blocksFor(refilled, "DEMO1006").some((b) => b.getAttribute("data-activity-group-id") === "DEMO1006:LEC"),
    ).toBe(true);

    await select("DEMO1006", "remove"); // leave the shared test DB clean
  });

  // (10) the auto-fill action never chooses between multi-option activities
  it('"Fill fixed activities" never chooses among a multi-option activity', async () => {
    await select("DEMO1001", "add"); // DEMO1001:TUT has 3 options, none chosen
    await fillFixed();

    const doc = await getIndexDocument();
    expect(doc.querySelector('.block[data-activity-group-id="DEMO1001:TUT"]')).toBeNull();

    await select("DEMO1001", "remove"); // leave the shared test DB clean
  });

  // (11) different courses carry stable, distinct colours
  it("courses carry stable, distinct colours across requests", async () => {
    const colours = new Set(DEMO_CATALOGUE.map((course) => course.colour));
    expect(colours.size).toBe(DEMO_CATALOGUE.length);

    await select("DEMO1001", "add");
    const first = await getIndexDocument();
    const second = await getIndexDocument();
    for (const doc of [first, second]) {
      const item = doc.querySelector('.course[data-course-id="DEMO1001"]');
      expect(item?.getAttribute("style")).toContain(findDemoCourse("DEMO1001")!.colour);
    }
    await select("DEMO1001", "remove"); // leave the shared test DB clean
  });

  // (12) invalid activity/course/option combinations are rejected server-side
  it("rejects invalid activity-selection combinations", async () => {
    expect((await postActivitySelection(new URLSearchParams({ action: "set", courseId: "DEMO9999", activityGroupId: "x", optionId: "y" }))).status).toBe(400);

    expect(
      (await postActivitySelection(new URLSearchParams({ action: "set", courseId: "DEMO1001", activityGroupId: "DEMO1001:NOPE", optionId: "y" }))).status,
    ).toBe(400);

    // A course must be selected before one of its activity options can be set.
    expect(
      (await postActivitySelection(new URLSearchParams({ action: "set", courseId: "DEMO1003", activityGroupId: "DEMO1003:LAB", optionId: "DEMO1003:LAB:1" }))).status,
    ).toBe(400);

    await select("DEMO1001", "add");
    // An option id that belongs to a different activity group entirely.
    expect(
      (await postActivitySelection(new URLSearchParams({ action: "set", courseId: "DEMO1001", activityGroupId: "DEMO1001:TUT", optionId: "DEMO1001:LEC:1" }))).status,
    ).toBe(400);
    await select("DEMO1001", "remove"); // leave the shared test DB clean
  });

  // (13) SSE continues streaming after the domain extension
  it("an activity-option change produces an SSE event of kind \"activity\"", async () => {
    await select("DEMO1003", "add");

    const stream = await fetch(new URL("/api/events", baseUrl));
    const reader = stream.body?.getReader();
    if (!reader) throw new Error("no response body");

    await setOption("DEMO1003", "DEMO1003:LAB", "DEMO1003:LAB:2");

    const decoder = new TextDecoder();
    let received = "";
    while (!received.includes("DEMO1003:LAB")) {
      const { value, done } = await reader.read();
      if (done) throw new Error("stream ended before the event arrived");
      received += decoder.decode(value, { stream: true });
    }
    await reader.cancel();
    expect(received).toContain(`"kind":"activity"`);
    expect(received).toContain(`"optionId":"DEMO1003:LAB:2"`);

    await select("DEMO1003", "remove"); // leave the shared test DB clean
  }, 10_000);
});
