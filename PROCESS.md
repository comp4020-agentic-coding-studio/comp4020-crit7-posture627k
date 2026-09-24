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

## Second iteration: activity types and time choices

The first iteration's course-level model — one flat list of sessions per
course, present as soon as the course was selected — was insufficient for a
real ANU-style timetable: a course's Lecture, Tutorial, and Lab aren't
interchangeable, don't all have to be scheduled, don't all offer only one
time, and aren't all mutually exclusive with each other. Modelling all of
that as undifferentiated "sessions" would have made required-vs-optional,
overlap policy, and multi-option choice impossible to express or enforce.

Built on top of the deployed course-level planner above, without redesigning
it: courses now expose one or more **activities** (Lecture/Tutorial/Lab/
Drop-in), each required or optional, overlap-allowed or not, with one or
more time options. No authentication, real ANU data, enrolment, or
scheduling solver was introduced. This work was committed as
[`8d4620b`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-posture627k/commit/8d4620b6238241dc5976518164c02eca9f2eef5a).

- `src/lib/catalogue.ts` was rewritten: each `DemoCourse`'s flat `sessions`
  list became `activities: ActivityGroup[]`, where a group carries `type`,
  `required`, `overlapAllowed`, and one or more `options` (day/start/end).
  Every course also gained a fixed `colour`. `DEMO1001`–`DEMO1006` kept
  their identifiers; their activities were redesigned so the catalogue
  demonstrates every required case: a single-fixed Lecture, several
  Tutorial choices, several Lab choices, a Drop-in, an optional activity, an
  overlap-allowed activity, and a deliberate Lecture-time clash between
  `DEMO1001` and `DEMO1002`.
- `src/lib/schema.ts` gained a second table, `selected_activity_options`
  (`activity_group_id` primary key, `course_id`, `option_id`) alongside the
  existing `selected_courses` — the smallest addition that lets SQLite
  record which time option is chosen per activity group, without
  duplicating any catalogue data. `pnpm db:generate` produced
  `drizzle/0002_parched_rocket_racer.sql` (its own auto-generated name, not
  invented); the two prior migrations were not touched. `src/lib/db.ts`
  gained `listSelectedActivityOptions`, `setActivityOption`,
  `clearActivityOption`, and a transactional bulk `setActivityOptions`;
  `deselectCourse` now deletes a removed course's activity-option rows in
  the same transaction as the course row, so removing a course leaves no
  trace of its timetable.
- `POST /api/selection`'s response body is unchanged
  (`{courseId, selected}`), so existing callers keep working. On `action=add`
  it now also writes, in the same request, every required activity that has
  exactly one time option for that course — there's nothing meaningful to
  choose, so the activity is part of the timetable as soon as the course is.
  A new route, `src/pages/api/activity-selection.ts`, handles `set`, `clear`,
  and `fill-fixed` for per-activity time choices: every `courseId`,
  `activityGroupId`, and `optionId` is checked against the catalogue (and
  that the course is currently selected) before anything is written;
  `fill-fixed` takes no client-supplied identifiers, so there is nothing for
  a client to forge into it, and it only ever fills a *required* activity
  with exactly one option — never a multi-option one.
- `src/lib/events.ts`'s `SelectionChangeEvent` became a discriminated union
  (`{kind:"course",...} | {kind:"activity",...}`) so activity-option changes
  travel over the same existing SSE channel and bus as course-level changes,
  rather than a second ad-hoc event format. `src/pages/api/events.ts` itself
  was not changed.
- `src/pages/index.astro` was rewritten to render each selected course's
  activity groups: a static line for a fixed (single-option, required)
  activity, and an accessible radio-button `fieldset` for anything else — a
  multi-option activity, or an optional activity of any option count, gets
  a "None" radio alongside its time choices. The timetable renders a block
  only for an activity option actually present in SQLite — never for an
  unselected course, an un-chosen multi-option activity, or an unselected
  optional one. Every block carries its course's fixed colour as a CSS
  custom property on a border accent (not a filled background, so text
  contrast never depends on which colour a course happens to have) and a
  text label (`DEMO1001 / Lecture / 10:00–11:00`) — colour is never the only
  cue. A slot holding more than one block where not everything present is
  overlap-allowed is marked "Clash" in text, rather than hiding either
  block. A "Fill fixed activities" button calls the bulk-fill action for a
  course that was already selected before one of its fixed activities got
  cleared or existed before this feature. The client script re-renders by
  re-fetching this same server-rendered page and swapping in the fresh
  `#catalogue-list`/`#timetable` markup, rather than duplicating clash
  detection, colouring, or labelling logic in JavaScript — so the DOM can
  never drift from what the server actually persisted.
- `spec/timetable.test.ts` gained a second `describe` block, "activity
  choices", with 13 new tests: no blocks for an unselected course; a fixed
  activity appearing on course selection; full removal of a course's
  activities on removal; all four activity types present in the catalogue;
  multi-option activities existing; choosing one option rendering only that
  option; switching an option swapping the rendered block; a chosen option
  surviving independent requests; "Fill fixed activities" restoring a
  cleared fixed activity; that same action never choosing among a
  multi-option activity; stable distinct course colours across requests;
  server-side rejection of invalid course/activity/option combinations; and
  an activity-kind SSE event. All 9 pre-existing `timetable` tests, and all
  of `spec/invariants.test.ts` and `spec/readme.test.ts`, were left
  untouched.
- `README.md` gained an "Activities and time choices" section plus two new
  mechanically-enforced bullets; `CLAUDE.md` gained three product rules
  pinning the catalogue as the authority for activity data, render-only-
  actual-selections, and the colour/text-label rule, for this extended
  model.

**Local verification** (before committing): `pnpm typecheck` — 0 errors;
`pnpm test` — 47/47 tests passing across 4 files; `pnpm check` — green.
Manually, against `pnpm dev` (a throwaway local database, cleaned up
afterward): with nothing selected, no course rendered any timetable block;
selecting `DEMO1005` (both activities single-option required) rendered both
its Lecture and Tutorial immediately; selecting `DEMO1001` (multi-option
Tutorial) rendered only its fixed Lecture — its Tutorial stayed unrendered
until an option was chosen, choosing one rendered exactly that option, and
switching to a different option removed the first block and rendered the
new one; removing `DEMO1001` removed every one of its blocks; selecting
`DEMO1002`, `DEMO1003`, and `DEMO1005` together showed three distinct,
stable colours; clearing `DEMO1003`'s fixed Lecture and then calling "Fill
fixed activities" restored exactly that block while leaving `DEMO1002`'s
optional multi-option Drop-in untouched; two independent `GET /` requests
returned identical selected courses and activity options; and, with one
`GET /api/events` connection held open, a `POST /api/activity-selection`
produced a `data: {"kind":"activity",...}` line on that connection — the
same protocol-level check used for the course-level SSE contract earlier in
this document. As before, no real browser could be driven in this
environment (Chrome cannot launch here — no working `libasound.so.2`, no
sudo), so the two-tab claim was checked at this same protocol level rather
than in an actual second tab; that limitation is unchanged from the
original implementation.

## Third iteration: colour-filled timetable blocks

The activity-level iteration above gave each course a fixed catalogue
colour, but only applied it as a border accent on each timetable block —
deliberately, at the time, to sidestep computing per-colour contrast for an
arbitrary background fill. On review this undersold the colour cue: a
border strip is easy to miss, and the ask was for blocks to be visibly
colour-coded so a course's activities read as one colour family at a
glance, distinct from every other course's.

`src/styles.css` was changed — no other file — so `.block` derives its
background from the same `--course-colour` custom property already set on
every block, via `color-mix(in srgb, var(--course-colour) 22%, white)`
behind an `@supports` check, falling back to the previous neutral
background in browsers without `color-mix()`. The mix ratio was chosen
deterministically (not per-colour-tuned or randomly generated) and checked
by hand against all six catalogue colours: mixing 22% of any of them into
white stays pale enough that the block's existing fixed dark text colour
(`#1a1a1a`) keeps strong contrast against every one, so no catalogue colour
value needed to change. Clash cells were not touched: two clashing blocks
already render as two separate stacked elements rather than one overlapping
box, so each keeps its own tint fully visible next to the other, with the
existing textual "Clash" label unchanged. This refinement was committed as
[`66b20b5`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-posture627k/commit/66b20b5ec725ee3062527b30f67469614a8a3763).

**Local verification**: `pnpm typecheck` — 0 errors; `pnpm test` — 47/47
tests passing, none added or changed (this was a CSS-only change with no
new externally visible contract to assert); `pnpm check` — green. Manually,
against `pnpm dev`: fetched the rendered page and its bundled CSS directly
and confirmed the `color-mix()` rule was present, that `DEMO1001` and
`DEMO1002` (the catalogue's deliberate Monday 10:00–11:00 clash pair)
rendered as two distinctly-coloured `.block` elements inside the same
`td.clash` cell, each still carrying its own `--course-colour` and the
`Clash` label still present as text. As with every other manual check in
this document, no real browser could be driven in this environment (Chrome
cannot launch here — no working `libasound.so.2`, no sudo), so this was
verified at the rendered-markup/CSS-source level rather than by looking at
it on screen.

## Fourth iteration: fixed-fill UX correction and a larger timetable

A production review after deployment surfaced two real usability problems in
the deployed app, not new feature requests:

**"Fill fixed activities" appeared to do nothing.** The root cause was in
`src/pages/api/selection.ts`: adding a course already called the same
single-option-required auto-fill logic the button was meant to trigger, in
the same request. So by the time a user pressed "Fill fixed activities",
every fixed activity for their selected courses had usually already been
persisted silently, and the button had nothing left to do — it was
technically implemented correctly, but the production UI made it look
broken. The fix removes that auto-fill from course add entirely: adding a
course now only ever selects the course. Persisting a single-option required
activity is exclusively `POST /api/activity-selection` with `action:
"fill-fixed"`, invoked only by that button, as its own explicit step. That
route now also distinguishes activities it actually just persisted from ones
already holding the right value, and returns a `filledCount` the client
displays through the existing `#selection-status` `aria-live="polite"`
region — "Filled N fixed activities." or "All fixed activities are already
filled." — so the action always gives visible, truthful feedback instead of
silently succeeding or silently doing nothing. A selected course with an
unfilled fixed activity now visibly says so in the catalogue ("Not yet in
timetable"), which was already present markup but previously unreachable in
practice since add had already filled the row underneath it.

**The timetable was visually too small.** `main`'s max-width and `.planner`'s
equal 1fr/1fr column split meant the timetable — the page's primary artefact
— shared the page evenly with the catalogue and was capped well below a
normal desktop viewport's width. `src/styles.css` now gives the timetable
column roughly 70% of the planner's width against the catalogue's 30%
(`minmax(18rem, 3fr) minmax(0, 7fr)`), raises `main`'s max-width so that
split has real room to work with, and increases the timetable's own
cell padding, row height, block padding, and font size so a course id,
activity type, and time read clearly at a glance. The table sits in its own
horizontally-scrollable wrapper with a minimum width, so on a viewport too
narrow for all five weekday columns at a readable size, the timetable
scrolls as its own region instead of shrinking every column until the text
is illegible; below a stacking breakpoint the catalogue and timetable stack
vertically instead, as before. None of the existing colour-fill or clash
styling from the previous iteration was touched.

Both corrections were verified against the existing test suite and two new
`spec/timetable.test.ts` cases protecting the corrected contract: that
selecting a course alone never persists its fixed activity, that "Fill fixed
activities" is idempotent and reports zero remaining work on a second call,
and that an optional single-option activity is never swept up by the fill
even though it technically has only one option. As with every prior
iteration, no real browser could be driven in this environment (Chrome
cannot launch here — no working `libasound.so.2`, no sudo), so the layout
change was verified at the rendered-HTML/CSS level, not by looking at it on
screen; a human visual check in a real browser is still required to confirm
how the enlarged timetable actually reads.

## Before you ship

`reflections/crit-7.md` still does not exist. This is intentional, not an
oversight: the reflection is deferred until after this implementation has
actually been deployed and exercised in production, so it can describe a
real outcome instead of a predicted one. `pnpm check:evidence` is expected
to fail only on that missing file until then.
