# Harness for this repo

These are the rules this project holds agent work to. They exist so future
work stays inside the locked Crit 7 scope instead of drifting toward a full
MyTimetable clone. `README.md` is the product contract; this file is how an
agent should behave while building toward it.

## Product rules

- Preserve the same-page course-selection + timetable workflow. Do not
  introduce a separate course-selection product page — the catalogue and the
  timetable stay part of one interaction context.
- Add/remove must produce visible timetable feedback immediately, without a
  full navigation away from that page.
- Keep the implementation intentionally small. Do not broaden the app into
  enrolment, degree planning, authentication, waitlists, or the complete
  MyTimetable product.
- Use controlled demo course/activity data. Do not wire in a live ANU API,
  scraped MyTimetable data, or real enrolment information unless a verified
  source is deliberately introduced later as its own explicit decision.

## Persistence rules

- SQLite is the source of truth for persistent selection state.
- Do not replace database persistence with `localStorage`. Browser-side
  state may support immediate rendering, but after a reload the page must
  reconstruct its state from the server/database, not from anything cached
  client-side.
- Schema changes go through the repository's existing Drizzle workflow: edit
  `src/lib/schema.ts`, run `pnpm db:generate`, commit the generated migration
  under `drizzle/`. Never hand-edit a deployed SQLite database.

## Server/security rules

- Preserve Astro's existing server-rendered architecture (`output: "server"`,
  the `@astrojs/node` adapter).
- Preserve the existing origin/CSRF protection — do not disable
  `security.checkOrigin` or prerender routes that need it.
- Preserve the Fly.io deployment shape in `fly.toml` (single machine, single
  volume, `DATABASE_PATH` on the volume) unless an explicit course
  requirement says otherwise.
- Never commit API keys or secrets. The pre-commit hook in `.githooks/` and
  CI's secret scan are not to be bypassed or weakened.

## SSE rules

- Preserve `/api/events`. `.github/workflows/checks.yml`'s deploy job probes
  it in production ("Verify the live-update stream is streaming") — deleting
  the endpoint breaks deployment, not just a feature.
- Repurpose the existing `EventEmitter`-backed SSE architecture
  (`src/lib/events.ts`, `src/pages/api/events.ts`) for timetable
  selection-change events rather than deleting it.
- Cross-tab live synchronisation is secondary to persisted correctness. Never
  treat delivery over the `EventEmitter`/SSE stream as confirmation that a
  change was persisted — it is a broadcast on top of SQLite, not a substitute
  for it. SQLite remains authoritative; a client that never had a tab open
  must still see the correct state on its next page load.

## Testing rules

- Do not delete or weaken `spec/invariants.test.ts` or `spec/readme.test.ts`.
- `spec/guestbook.test.ts` retires only once the guestbook functionality it
  probes has actually been replaced by timetable-domain product tests — not
  before, and not by just deleting it early.
- New tests should assert externally visible contracts (what a page must do)
  rather than internal implementation details, so they survive a change of
  approach.
- If a new product page is ever added, update `spec/routes.ts` with its
  exact route so the invariants keep covering it.
- Keep meeting the existing invariant suite on every page: one top-level
  `<h1>`, a navigation landmark, a declared document language, viewport
  metadata, a real title, alt text on every image, and the axe-core
  accessibility floor.

## Precision rules

- Never guess identifiers, form field names, routes, schema fields, migration
  names, selectors, or file paths.
- Inspect the actual file before referring to a repository identifier in code
  or in writing.
- Prefer the smallest implementation that satisfies the product contract in
  `README.md`.
