# Crit 7 reflection

## What was the breakthrough that moved the work forward?

The real breakthrough came before any code: narrowing "build a timetable" down
to one specific interaction — course selection and its timetable consequence
living on the same page, with no separate views to reconcile. Writing that
contract into `README.md`, and the harness it implies into `CLAUDE.md`, before
implementing anything gave later work a fence to build inside instead of
drifting toward a full MyTimetable clone. The second breakthrough was
technical: realising a course isn't one flat list of sessions but activity
groups (Lecture, Tutorial, Lab, Drop-in), each with its own options, required
or optional. That model let required-vs-optional and single-vs-multiple time
choices exist as real, checkable states, with SQLite as the one source of
truth and SSE as a courtesy broadcast on top of it, never a substitute.

## What did this work change about who I want to be as a software developer?

It sharpened my sense that automated correctness and human judgment answer
different questions. My test suite happily passed while "Fill fixed
activities" was quietly redundant and the timetable was too small to read
comfortably — both defects only surfaced once a person actually looked at the
running product. That's changed how I want to work: treat a green test suite
as necessary, not sufficient, and build in a real human look at the deployed
thing before calling anything finished. It also reinforced a preference for
reusing working infrastructure — the existing Astro/SQLite/SSE plumbing —
rather than replacing it just because the feature on top of it changed, and
for keeping fixes scoped to the actual defect a reviewer reported, not an
excuse to redesign.
