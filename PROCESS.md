# Process overview

## What I built

A same-page ANU timetable planning prototype that replaces the Guestbook
starter, per the contract in `README.md`: a controlled catalogue of six
fictional demo courses and a weekly timetable share one page. Adding or
removing a course updates the visible timetable immediately once the server
confirms the write, the selection is persisted in SQLite (so a reload
restores it), and other open tabs are notified of a change over the same
SSE stream the starter used for its guestbook.

## How I got here

**Baseline audit.** Starting from this repo's starting commits —
[`9260e7d`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-posture627k/commit/9260e7dd06ba3b600acf301286c23e5ecda52ad6)
(initial commit) and
[`e1fef6a`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-posture627k/commit/e1fef6ae82fa7d0a4a88b9c3edde3043a4ebf0d7)
(the course's automated template resync) — the untouched Guestbook starter
was cloned, its toolchain verified against `mise.toml` (Node 24, pnpm
11.9.0), and dependencies installed with `pnpm install --frozen-lockfile`.
`pnpm check` passed in full on this unmodified starter: 0 typecheck errors
and 28/28 tests green. `pnpm check:evidence` failed in the expected way for
an unstarted submission: `PROCESS.md` still carried its template comment,
neither of its two placeholder commit citations resolved, and no
`reflections/crit-7.md` existed yet. The running dev server was exercised
manually — page load, message submission, reload persistence, and the SSE
live-update stream all worked as the starter claims.

**Scope decision.** The product direction was fixed as a same-page ANU
timetable planner: course-selection controls and the weekly timetable share
one interaction context, so adding or removing a demo course changes the
visible timetable immediately, with no navigation to a separate page. This
is explicitly one narrow interaction slice, not a MyTimetable replacement —
no ANU authentication, real enrolment, live MyTimetable integration, or full
course catalogue.

**SSE decision.** Because `.github/workflows/checks.yml`'s deploy job
already probes `/api/events` in production ("Verify the live-update stream
is streaming"), the decision was made to preserve and repurpose the existing
SSE channel for timetable selection-change broadcasts rather than deleting
it — deleting it would break the existing production contract, not just
remove a feature.

**Contract and harness checkpoint.** `README.md` and `CLAUDE.md` were
rewritten to state the locked product contract and the harness rules that
follow from it, and an implementation design (data ownership, database
shape, request flow, the immediate-update mechanism, the SSE repurposing
plan, the timetable UI layout, the demo dataset, and the test-replacement
plan) was produced for review. These three docs-only changes were committed
as
[`3a04b40`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-posture627k/commit/3a04b40811ce65434796a1042cf64ba8346e5c68).

**Implementation.** Built on top of that checkpoint and committed as
[`2313309`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-posture627k/commit/2313309707777ff66fe50577808cb6e868bb285c):

- `src/lib/catalogue.ts` is the single source of truth for six fictional
  demo courses (`DEMO1001`–`DEMO1006`), each with Mon–Fri sessions inside a
  09:00–17:00 window. `src/lib/schema.ts` was rewritten to a single
  `selected_courses` table (`course_id` primary key) replacing `messages`;
  `pnpm db:generate` produced the migration
  `drizzle/0001_careless_tyger_tiger.sql`, which creates `selected_courses`
  and drops `messages` — a genuine new table, not a rename, since the two
  share no meaningful column overlap. `src/lib/db.ts` now exposes
  `listSelectedCourseIds`, `selectCourse`, and `deselectCourse` in place of
  `listMessages`/`addMessage`.
- `POST /api/selection` (`src/pages/api/selection.ts`) validates `courseId`
  against the catalogue and `action` against `add`/`remove`, returning 400
  on either failure before touching the database. On valid input it writes
  SQLite first, then emits a `SelectionChangeEvent` (`{ courseId, selected
  }`, defined once in `src/lib/events.ts`) on the existing `EventEmitter`
  bus, then returns that same JSON as the 200 response body.
- `src/pages/api/events.ts` keeps the exact SSE shape the starter shipped
  (opening `: connected` comment, 30 s heartbeat, `text/event-stream`), just
  streaming `SelectionChangeEvent` payloads under a `selection` bus event
  instead of guestbook messages. `/api/events` itself was never deleted, and
  `.github/workflows/checks.yml` was not touched.
- `src/pages/index.astro` server-renders the catalogue and an 8-row ×
  5-column weekly timetable table from `listSelectedCourseIds()` on every
  request. A small client-side script POSTs to `/api/selection` on a
  catalogue button click, waits for a successful response, and only then
  toggles that button's state and reveals/hides the matching timetable
  block(s) — the page never commits a change before the server confirms it,
  and a failed request leaves the prior state visible with an inline error
  message instead. A second script subscribes to `/api/events` and applies
  the same idempotent update function to every open tab.
- `spec/guestbook.test.ts` was deleted only after `spec/timetable.test.ts`
  was written and passing: it asserts the catalogue and timetable share a
  page, that an unknown `courseId` is rejected, that a known demo course can
  be added and removed through the real endpoint, that a fresh `GET /`
  reflects each change, that the selection survives two independent
  requests, and that `/api/events` streams and broadcasts a real mutation.
  `spec/invariants.test.ts`, `spec/readme.test.ts`, and `spec/routes.ts`
  were left untouched.
- A repo-wide search for `Guestbook`/`messages`/`addMessage`/`listMessages`/
  `/api/messages` turned up two stale documentation references — a nav
  label in `src/pages/readme.astro` still reading "Guestbook", and a
  present-tense description of `guestbook.test.ts` in `spec/README.md` — and
  one stale rule in `CLAUDE.md` naming a test that had by then already
  retired; all three were corrected. The remaining matches are the intact
  `0000` migration history (never hand-edited) and this document's own
  truthful account of the starter baseline, which stay as they are.

**Local verification** (before committing the implementation): `pnpm
typecheck` — 0 errors; `pnpm test` (`astro build && vitest run`) — 34/34
tests passing across 4 files; `pnpm check` — green. Manually, against
`pnpm dev`: a fresh local database started with every course unselected;
adding `DEMO1001` returned `{"courseId":"DEMO1001","selected":true}` and a
subsequent `GET /` rendered its button as pressed and its timetable block
visible; adding `DEMO1003` (two sessions) showed both of its blocks;
removing `DEMO1001` and reloading showed only `DEMO1003`'s blocks, and
removing it left every course unselected again — persistence across
independent requests, not just the mutating response, was checked at each
step. For the two-tab claim, a real browser could not be driven in this
environment (Chrome cannot launch here — no working `libasound.so.2` and no
sudo to install it), so the cross-tab path was checked at the protocol level
instead: with one `GET /api/events` connection left open, a `POST
/api/selection` on a second, independent connection produced a `data:
{"courseId":"DEMO1003","selected":false}` line on the first connection —
the exact event the page's `EventSource` handler consumes to update a
second tab's DOM.

## Before you ship

`reflections/crit-7.md` still does not exist. This is intentional, not an
oversight: the reflection is deferred until after this implementation has
actually been deployed and exercised in production, so it can describe a
real outcome instead of a predicted one. `pnpm check:evidence` is expected
to fail only on that missing file until then.
