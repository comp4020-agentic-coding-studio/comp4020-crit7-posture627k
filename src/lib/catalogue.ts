// The prototype's controlled demo catalogue: fictional course-like entries
// invented to demonstrate the same-page course/activity/timetable
// interaction. These do not represent any real current ANU course, activity,
// or session. Every id starts with DEMO so it can't be mistaken for a real
// ANU course code. This is the single source of truth for catalogue data —
// the timetable page, the selection APIs, and the tests all read it from
// here. Nothing here is persisted; SQLite only stores which course ids and
// which activity-group option ids are currently selected (src/lib/schema.ts).
export type Weekday = "Mon" | "Tue" | "Wed" | "Thu" | "Fri";

export type ActivityType = "Lecture" | "Tutorial" | "Lab" | "Drop-in";

export interface ActivityOption {
  id: string;
  day: Weekday;
  start: string; // "HH:MM", 24-hour, hour-aligned
  end: string; // "HH:MM", 24-hour, hour-aligned
}

export interface ActivityGroup {
  id: string;
  type: ActivityType;
  // Required: part of the course's expected timetable, and the user is
  // meant to choose one option if more than one exists. Optional: the
  // activity does not have to be scheduled at all.
  required: boolean;
  // Whether this activity is allowed to occupy the same timetable slot as
  // another activity without that being treated as a scheduling clash — used
  // for casual activities (like a drop-in) that aren't mutually exclusive
  // with a fixed class the way two required activities are.
  overlapAllowed: boolean;
  options: ActivityOption[];
}

export interface DemoCourse {
  id: string;
  title: string;
  // A stable colour for every block rendered for this course, fixed here
  // rather than generated client-side so it never changes between reloads.
  // Blocks always carry a text label too — colour is never the only cue.
  colour: string;
  activities: ActivityGroup[];
}

export const WEEKDAYS: Weekday[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];

// The timetable's visible time window: one row per hour, 09:00 to 17:00.
export const DAY_START_HOUR = 9;
export const DAY_END_HOUR = 17;

export const DEMO_CATALOGUE: DemoCourse[] = [
  {
    id: "DEMO1001",
    title: "Intro to Interaction Design",
    colour: "#1d4ed8",
    activities: [
      {
        id: "DEMO1001:LEC",
        type: "Lecture",
        required: true,
        overlapAllowed: false,
        // Fixed: exactly one option, nothing to choose between.
        options: [{ id: "DEMO1001:LEC:1", day: "Mon", start: "10:00", end: "11:00" }],
      },
      {
        id: "DEMO1001:TUT",
        type: "Tutorial",
        required: true,
        overlapAllowed: false,
        // Several choices: the user must pick one.
        options: [
          { id: "DEMO1001:TUT:1", day: "Tue", start: "10:00", end: "11:00" },
          { id: "DEMO1001:TUT:2", day: "Wed", start: "14:00", end: "15:00" },
          { id: "DEMO1001:TUT:3", day: "Thu", start: "09:00", end: "10:00" },
        ],
      },
    ],
  },
  {
    id: "DEMO1002",
    title: "Foundations of Databases",
    colour: "#15803d",
    activities: [
      {
        id: "DEMO1002:LEC",
        type: "Lecture",
        required: true,
        overlapAllowed: false,
        // Deliberately the same slot as DEMO1001's lecture, so selecting
        // both courses demonstrates a real required-activity clash.
        options: [{ id: "DEMO1002:LEC:1", day: "Mon", start: "10:00", end: "11:00" }],
      },
      {
        id: "DEMO1002:DRP",
        type: "Drop-in",
        required: false,
        overlapAllowed: true,
        options: [
          { id: "DEMO1002:DRP:1", day: "Fri", start: "13:00", end: "14:00" },
          { id: "DEMO1002:DRP:2", day: "Fri", start: "15:00", end: "16:00" },
        ],
      },
    ],
  },
  {
    id: "DEMO1003",
    title: "Human-Centred Systems",
    colour: "#b45309",
    activities: [
      {
        id: "DEMO1003:LEC",
        type: "Lecture",
        required: true,
        overlapAllowed: false,
        options: [{ id: "DEMO1003:LEC:1", day: "Tue", start: "09:00", end: "10:00" }],
      },
      {
        id: "DEMO1003:LAB",
        type: "Lab",
        required: true,
        overlapAllowed: false,
        options: [
          { id: "DEMO1003:LAB:1", day: "Wed", start: "11:00", end: "13:00" },
          { id: "DEMO1003:LAB:2", day: "Thu", start: "11:00", end: "13:00" },
        ],
      },
    ],
  },
  {
    id: "DEMO1004",
    title: "Applied Networks",
    colour: "#6d28d9",
    activities: [
      {
        id: "DEMO1004:LEC",
        type: "Lecture",
        required: true,
        overlapAllowed: false,
        options: [{ id: "DEMO1004:LEC:1", day: "Wed", start: "14:00", end: "15:00" }],
      },
      {
        id: "DEMO1004:DRP",
        type: "Drop-in",
        required: false,
        overlapAllowed: true,
        // A single option, but still optional: not eligible for the
        // fixed-activity bulk fill, which only ever fills required activities.
        options: [{ id: "DEMO1004:DRP:1", day: "Fri", start: "10:00", end: "11:00" }],
      },
    ],
  },
  {
    id: "DEMO1005",
    title: "Prototyping Studio",
    colour: "#be185d",
    activities: [
      {
        id: "DEMO1005:LEC",
        type: "Lecture",
        required: true,
        overlapAllowed: false,
        options: [{ id: "DEMO1005:LEC:1", day: "Thu", start: "15:00", end: "16:00" }],
      },
      {
        id: "DEMO1005:TUT",
        type: "Tutorial",
        required: true,
        overlapAllowed: false,
        options: [{ id: "DEMO1005:TUT:1", day: "Fri", start: "09:00", end: "10:00" }],
      },
    ],
  },
  {
    id: "DEMO1006",
    title: "Software Architecture",
    colour: "#334155",
    activities: [
      {
        id: "DEMO1006:LEC",
        type: "Lecture",
        required: true,
        overlapAllowed: false,
        options: [{ id: "DEMO1006:LEC:1", day: "Fri", start: "11:00", end: "12:00" }],
      },
      {
        id: "DEMO1006:LAB",
        type: "Lab",
        required: true,
        overlapAllowed: false,
        options: [{ id: "DEMO1006:LAB:1", day: "Mon", start: "13:00", end: "15:00" }],
      },
    ],
  },
];

export function findDemoCourse(courseId: string): DemoCourse | undefined {
  return DEMO_CATALOGUE.find((course) => course.id === courseId);
}

export function findActivityGroup(
  courseId: string,
  activityGroupId: string,
): ActivityGroup | undefined {
  return findDemoCourse(courseId)?.activities.find((group) => group.id === activityGroupId);
}

export function findActivityOption(
  courseId: string,
  activityGroupId: string,
  optionId: string,
): ActivityOption | undefined {
  return findActivityGroup(courseId, activityGroupId)?.options.find(
    (option) => option.id === optionId,
  );
}

// Every required activity group across a set of selected courses that has
// exactly one option — the set "Fill fixed activities" auto-selects.
export function singleOptionRequiredGroups(
  courseIds: string[],
): { courseId: string; group: ActivityGroup }[] {
  return courseIds.flatMap((courseId) => {
    const course = findDemoCourse(courseId);
    if (!course) return [];
    return course.activities
      .filter((group) => group.required && group.options.length === 1)
      .map((group) => ({ courseId, group }));
  });
}
