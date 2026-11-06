export type Period = {
  key: string;
  label: string;
  start: number; // minutes from midnight (IST)
  end: number;
  isBreak?: boolean;
};

const t = (h: number, m: number) => h * 60 + m;

export const PERIODS: Period[] = [
  { key: "P1", label: "P1", start: t(8, 10), end: t(9, 0) },
  { key: "P2", label: "P2", start: t(9, 0), end: t(9, 50) },
  { key: "P3", label: "P3", start: t(10, 0), end: t(10, 50) },
  { key: "P4", label: "P4", start: t(10, 50), end: t(11, 40) },
  { key: "P5", label: "P5", start: t(11, 50), end: t(12, 40) },
  { key: "LUNCH", label: "Break", start: t(12, 40), end: t(13, 10), isBreak: true },
  { key: "P7", label: "P7", start: t(13, 20), end: t(14, 10) },
  { key: "P8", label: "P8", start: t(14, 10), end: t(15, 0) },
  { key: "P9", label: "P9", start: t(15, 0), end: t(15, 50) },
  { key: "P10", label: "P10", start: t(15, 50), end: t(16, 40) },
  { key: "P11", label: "P11", start: t(16, 40), end: t(17, 30) },
];

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export type Day = (typeof DAYS)[number];

export type ClassSlot = { coursecode: string; section: string; room: string; venue?: string };

const CAD = "CAD Centre";
const CC = "Computer Centre";

export const TIMETABLE: Record<Day, Record<string, ClassSlot | null>> = {
  Mon: {
    P1: { coursecode: "24CS3207-L", section: "S-4", room: "K-408" },
    P2: { coursecode: "24CS3207-L", section: "S-4", room: "K-408" },
    P3: { coursecode: "24CS3105-L", section: "S-4", room: "K-407" },
    P4: { coursecode: "24CS3105-T", section: "S-4", room: "K-407" },
    P5: { coursecode: "24DEA3101-L", section: "S-4", room: "K-313" },
    P7: { coursecode: "24CI3201-P", section: "S-14", room: "K-313" },
    P8: { coursecode: "24CI3201-P", section: "S-14", room: "K-313" },
    P9: { coursecode: "24CI3201-P", section: "S-14", room: "K-313" },
    P10: null,
    P11: null,
  },
  Tue: {
    P1: { coursecode: "24CS3105-L", section: "S-4", room: "K-306" },
    P2: { coursecode: "24CS3105-L", section: "S-4", room: "K-306" },
    P3: { coursecode: "24CS3207-P", section: "S-4", room: "K-414" },
    P4: { coursecode: "24CS3207-P", section: "S-4", room: "K-414" },
    P5: { coursecode: "24SDCS03-L", section: "S-6", room: "K-407" },
    P7: { coursecode: "24DEA3101-P", section: "S-4", room: "K-413" },
    P8: { coursecode: "24DEA3101-P", section: "S-4", room: "K-413" },
    P9: { coursecode: "24DEA3101-P", section: "S-4", room: "K-413" },
    P10: null,
    P11: null,
  },
  Wed: {
    P1: { coursecode: "24CC3014-S", section: "S-4", room: "K-204", venue: CAD },
    P2: { coursecode: "24SDCS03-L", section: "S-6", room: "K-204", venue: CAD },
    P3: { coursecode: "24CI3201-L", section: "S-14", room: "K-004", venue: CC },
    P4: { coursecode: "24CI3201-L", section: "S-14", room: "K-004", venue: CC },
    P5: { coursecode: "24CS3207-L", section: "S-4", room: "K-004", venue: CC },
    P7: { coursecode: "24CS3207-L", section: "S-4", room: "K-004", venue: CC },
    P8: { coursecode: "24CS3105-T", section: "S-4", room: "K-204", venue: CAD },
    P9: null,
    P10: { coursecode: "24CC3014-S", section: "S-4", room: "K-204", venue: CAD },
    P11: null,
  },
  Thu: {
    P1: { coursecode: "24CC3014-S", section: "S-4", room: "K-204", venue: CAD },
    P2: { coursecode: "24CS3105-L", section: "S-4", room: "K-204", venue: CAD },
    P3: { coursecode: "24DEA3101-L", section: "S-4", room: "K-004", venue: CC },
    P4: { coursecode: "24DEA3101-L", section: "S-4", room: "K-004", venue: CC },
    P5: { coursecode: "24CS2235F-L", section: "S-6", room: "K-004", venue: CC },
    P7: { coursecode: "24CS2235F-L", section: "S-6", room: "K-004", venue: CC },
    P8: { coursecode: "24CS3105-T", section: "S-4", room: "K-204", venue: CAD },
    P9: null,
    P10: null,
    P11: { coursecode: "24CC3014-S", section: "S-4", room: "K-204", venue: CAD },
  },
  Fri: {
    P1: { coursecode: "24SDCS03-S", section: "S-6", room: "K-008" },
    P2: { coursecode: "24SDCS03-S", section: "S-6", room: "K-008" },
    P3: { coursecode: "24DEA3101-L", section: "S-4", room: "K-114" },
    P4: { coursecode: "24DEA3101-L", section: "S-4", room: "K-114" },
    P5: { coursecode: "24CI3201-L", section: "S-14", room: "K-413" },
    P7: { coursecode: "24CS2235F-P", section: "S-6", room: "K-414" },
    P8: { coursecode: "24CS2235F-P", section: "S-6", room: "K-414" },
    P9: { coursecode: "24CS2235F-P", section: "S-6", room: "K-414" },
    P10: null,
    P11: null,
  },
  Sat: {
    P1: { coursecode: "24CI3201-L", section: "S-14", room: "K-314" },
    P2: { coursecode: "24CI3201-L", section: "S-14", room: "K-314" },
    P3: { coursecode: "24CS2235F-L", section: "S-6", room: "K-413" },
    P4: { coursecode: "24CS2235F-L", section: "S-6", room: "K-413" },
    P5: { coursecode: "24CS3207-L", section: "S-4", room: "K-408" },
    P7: { coursecode: "24SDCS03-S", section: "S-6", room: "K-008" },
    P8: { coursecode: "24SDCS03-S", section: "S-6", room: "K-008" },
    P9: { coursecode: "24SDCS03-S", section: "S-6", room: "K-008" },
    P10: null,
    P11: null,
  },
};

/** Type suffix meaning. */
export const TYPE_LABELS: Record<string, string> = {
  L: "Lecture",
  T: "Tutorial",
  P: "Practical",
  S: "Seminar / Skill",
};

/** Per-course accent colors (CSS color values). */
export const COURSE_COLORS: Record<string, string> = {
  "24CS3207": "#FF7A1A",
  "24CS3105": "#3DFF7A",
  "24DEA3101": "#4CC9F0",
  "24CI3201": "#F472B6",
  "24SDCS03": "#FACC15",
  "24CC3014": "#A78BFA",
  "24CS2235F": "#FB7185",
};

export function splitCourse(coursecode: string) {
  const match = coursecode.match(/^(.*)-([LTPS])$/);
  return { base: match?.[1] ?? coursecode, type: match?.[2] ?? "" };
}

export function courseColor(coursecode: string) {
  return COURSE_COLORS[splitCourse(coursecode).base] ?? "#9CA3AF";
}

/** Current date/time expressed in IST. */
export function istNow(now: Date = new Date()) {
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const dayIndex = ist.getUTCDay(); // 0 = Sunday
  const day: Day | null = dayIndex >= 1 && dayIndex <= 6 ? DAYS[dayIndex - 1]! : null;
  const hh = String(ist.getUTCHours()).padStart(2, "0");
  const mm = String(ist.getUTCMinutes()).padStart(2, "0");
  return {
    day,
    minutes: ist.getUTCHours() * 60 + ist.getUTCMinutes(),
    dateString: ist.toISOString().slice(0, 10),
    timeString: `${hh}:${mm}`,
  };
}

export function formatPeriodTime(p: Period) {
  const fmt = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, "0")}`;
  };
  return `${fmt(p.start)}–${fmt(p.end)}`;
}

/** Retrieve dynamic timetable from DB if available, otherwise return default timetable. */
export async function getTimetable(
  db?: any,
): Promise<Record<Day, Record<string, ClassSlot | null>>> {
  if (db) {
    try {
      const { data } = await db.from("timetable").select("data").eq("id", 1).maybeSingle();
      if (data?.data && typeof data.data === "object" && Object.keys(data.data).length > 0) {
        return data.data as Record<Day, Record<string, ClassSlot | null>>;
      }
    } catch {
      // Return static TIMETABLE if timetable table not ready
    }
  }
  return TIMETABLE;
}

