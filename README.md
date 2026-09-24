# ANU timetable planner (prototype)

## What this is

ANU's course-selection and timetable views are normally separate: you pick
courses somewhere, then switch to a different view to see your week. This
prototype removes that switch for one narrow interaction: **choosing which
courses you're taking, and seeing your weekly timetable, live on the same
page.** Adding or removing a course from the selection updates the visible
timetable immediately, without navigating anywhere else.

This is **not** ANU MyTimetable, and it does not integrate with ANU
enrolment, ANU authentication, or Wattle. The course/activity catalogue it
offers is controlled demo data invented for this prototype — it does not
claim to reflect any actual current ANU course or session.

## What good looks like here

These are the contracts this prototype is judged against. Some are checked
automatically by `spec/`; others are judgement calls a reader has to assess
by using the app.

**Mechanically enforced** (checked by the test suite in `spec/`):

- Course-management controls and the timetable appear on the same product
  page — there is no separate course-selection page to navigate to.
- A course can be added, and a course can be removed, without leaving that
  page.
- Selected courses are persisted through the server into SQLite, and
  reloading the page restores the saved selection and the timetable that
  matches it.
- The page meets the same accessibility/structural floor as every page in
  this app: one top-level heading, a navigation landmark, a declared
  language, a real title, a mobile viewport, alt text on every image, and
  the axe-core accessibility floor.

**Judgement calls** (not mechanically checked, assessed by looking):

- Whether the visible timetable makes the *consequence* of adding or
  removing a course easy to read at a glance.
- Whether the layout reads sensibly at both wide and narrow widths — wide
  screens show the catalogue and timetable side by side; narrow screens may
  stack them vertically rather than forcing an unusable two-column layout.
- Whether cross-tab live updates (see below) feel like a helpful bonus
  rather than something the core workflow depends on.

Cross-tab updates may use this app's existing server-sent-events channel, so
that a change made in one open tab can appear in another. That behaviour is
supporting, not the product's main purpose — the primary contract is
same-page feedback plus SQLite persistence, which works with only one tab
open.

## Out of scope

This prototype deliberately does not attempt:

- ANU authentication / SSO
- real enrolment
- live MyTimetable integration or scraping
- waitlists or capacity management
- the full ANU course catalogue
- degree planning
- Wattle integration
- multi-user accounts
- drag-and-drop scheduling
