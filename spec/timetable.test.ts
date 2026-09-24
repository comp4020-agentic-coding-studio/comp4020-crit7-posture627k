import { JSDOM } from "jsdom";
import { describe, expect, inject, it } from "vitest";
import { DEMO_CATALOGUE } from "../src/lib/catalogue";

// Drives the running app over HTTP (spec/global-setup.ts boots the built
// server against a throwaway SQLite file) to prove the timetable planner's
// contract holds in THIS repo: a demo course can be added and removed
// through the real /api/selection endpoint, the change is visible in the
// server-rendered timetable on a fresh page load (SQLite, not the response
// body, is what's being checked), and other open tabs would hear about it
// over the same SSE stream the guestbook starter used.
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
  const block = doc.querySelector(`.block[data-course-id="${id}"]`);
  return (
    button?.getAttribute("aria-pressed") === "true" &&
    block !== null &&
    !block.hasAttribute("hidden")
  );
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
