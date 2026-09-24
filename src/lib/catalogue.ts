// The prototype's controlled demo catalogue: fictional course-like entries
// invented to demonstrate the same-page add/remove/timetable interaction.
// These do not represent any real current ANU course or session. Every id
// starts with DEMO so it can't be mistaken for a real ANU course code.
// This is the single source of truth for catalogue data — the timetable
// page, the selection API, and the tests all read it from here.
export type Weekday = "Mon" | "Tue" | "Wed" | "Thu" | "Fri";

export interface DemoSession {
  day: Weekday;
  start: string; // "HH:MM", 24-hour, hour-aligned
  end: string; // "HH:MM", 24-hour, hour-aligned
}

export interface DemoCourse {
  id: string;
  title: string;
  sessions: DemoSession[];
}

export const WEEKDAYS: Weekday[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];

// The timetable's visible time window: one row per hour, 09:00 to 17:00.
export const DAY_START_HOUR = 9;
export const DAY_END_HOUR = 17;

export const DEMO_CATALOGUE: DemoCourse[] = [
  {
    id: "DEMO1001",
    title: "Intro to Interaction Design",
    sessions: [{ day: "Mon", start: "10:00", end: "11:00" }],
  },
  {
    id: "DEMO1002",
    title: "Foundations of Databases",
    sessions: [{ day: "Mon", start: "13:00", end: "14:00" }],
  },
  {
    id: "DEMO1003",
    title: "Human-Centred Systems",
    sessions: [
      { day: "Tue", start: "09:00", end: "10:00" },
      { day: "Thu", start: "09:00", end: "10:00" },
    ],
  },
  {
    id: "DEMO1004",
    title: "Applied Networks",
    sessions: [{ day: "Wed", start: "11:00", end: "13:00" }],
  },
  {
    id: "DEMO1005",
    title: "Prototyping Studio",
    sessions: [{ day: "Thu", start: "14:00", end: "16:00" }],
  },
  {
    id: "DEMO1006",
    title: "Software Architecture",
    sessions: [{ day: "Fri", start: "10:00", end: "11:00" }],
  },
];

export function findDemoCourse(courseId: string): DemoCourse | undefined {
  return DEMO_CATALOGUE.find((course) => course.id === courseId);
}
