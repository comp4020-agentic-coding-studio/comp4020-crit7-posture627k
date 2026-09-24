# Process overview

## What I built

Nothing yet. This document currently records the audit and design work done
*before* touching application code: establishing the untouched starter
baseline, locking a product scope, and designing (but not yet implementing)
the timetable-domain replacement for the Guestbook starter. `README.md`
describes the product contract this work is building toward.

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

**Documentation and design pass.** `README.md` and `CLAUDE.md` were rewritten
to state the locked product contract and the harness rules that follow from
it. An implementation design (data ownership, database shape, request flow,
the immediate-update mechanism, the SSE repurposing plan, the timetable UI
layout, the demo dataset, and the test-replacement plan) was produced for
review, but no application code — schema, routes, pages, or tests — has been
changed yet.

## Before you ship

`pnpm check:evidence` cannot pass yet, and this is expected, not a bug: no
`reflections/crit-7.md` exists, because the reflection asks what the work
changed and what breakthrough moved it forward, and no implementation has
happened yet to answer that honestly. That file is intentionally deferred to
the final phase. Once implementation work is committed, this document will
be updated again with citations to those commits.
