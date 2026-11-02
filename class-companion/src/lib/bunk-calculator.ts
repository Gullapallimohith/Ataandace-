import { DAYS, PERIODS, TIMETABLE, type Day, type ClassSlot, splitCourse } from "./timetable";
import type { SupabaseClient } from "@supabase/supabase-js";

export const WEIGHTS: Record<string, number> = { L: 1, P: 0.5, T: 0.25, S: 0.25 };
export const COMPONENT_LABELS: Record<string, string> = {
  L: "Lecture",
  P: "Practical",
  T: "Tutorial",
  S: "Skill / Seminar",
};

export type BunkCourseImpact = {
  coursecode: string;
  coursedesc: string;
  periodsBunked: number;
  componentsAffected: {
    code: string;
    label: string;
    missed: number;
    currentConducted: number;
    currentAttended: number;
    currentPct: number;
    newConducted: number;
    newAttended: number;
    newPct: number;
    dropPct: number;
  }[];
  currentWeighted: number;
  newWeighted: number;
  dropWeighted: number;
  danger: boolean; // dropped below 75%
  warning: boolean; // dropped below 85%
};

export type BunkCalculationResult = {
  input: string;
  dateStr: string;
  day: Day;
  isWeekend: boolean;
  totalPeriodsScheduled: number;
  schedule: { period: string; time: string; slot: ClassSlot }[];
  currentOverallPct: number;
  newOverallPct: number;
  overallDropPct: number;
  coursesImpacted: BunkCourseImpact[];
  usingBaseline: boolean;
  summary: string;
};

const DAY_MAP: Record<string, Day> = {
  mon: "Mon",
  monday: "Mon",
  tue: "Tue",
  tues: "Tue",
  tuesday: "Tue",
  wed: "Wed",
  wednesday: "Wed",
  thu: "Thu",
  thur: "Thu",
  thurs: "Thu",
  thursday: "Thu",
  fri: "Fri",
  friday: "Fri",
  sat: "Sat",
  saturday: "Sat",
};

/** Parse /bunk command input like "/bunk 28-10-2026 Tuesday" or "28-10-2026" */
export function parseBunkQuery(query: string): { dateStr: string; day: Day | null; isWeekend: boolean } {
  const clean = query.replace(/^\/bunk\s*/i, "").trim();
  const parts = clean.split(/\s+/).filter(Boolean);

  let dateStr = "";
  let explicitDay: string | null = null;

  for (const part of parts) {
    // Check if it's a date like dd-mm-yyyy or yyyy-mm-dd or dd/mm/yyyy
    if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(part) || /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(part)) {
      dateStr = part;
    } else if (DAY_MAP[part.toLowerCase()] || part.toLowerCase() === "sun" || part.toLowerCase() === "sunday") {
      explicitDay = part.toLowerCase();
    }
  }

  let day: Day | null = null;
  let isWeekend = false;

  if (explicitDay) {
    if (explicitDay === "sun" || explicitDay === "sunday") {
      isWeekend = true;
    } else {
      day = DAY_MAP[explicitDay] ?? null;
    }
  }

  // If date was given, try to parse it to determine the day if not explicitly given
  if (dateStr) {
    const dParts = dateStr.split(/[-/]/).map(Number);
    let d: Date | null = null;
    if (dParts.length === 3) {
      if (dParts[0]! > 31) {
        // yyyy-mm-dd
        d = new Date(dParts[0]!, dParts[1]! - 1, dParts[2]!);
      } else {
        // dd-mm-yyyy
        d = new Date(dParts[2]!, dParts[1]! - 1, dParts[0]!);
      }
    }
    if (d && !isNaN(d.getTime())) {
      const dayIdx = d.getDay(); // 0 is Sunday
      if (dayIdx === 0) {
        isWeekend = true;
      } else if (!day) {
        const daysArr: Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        day = daysArr[dayIdx - 1] ?? null;
      }
    }
  }

  // Default to today if nothing matched
  if (!day && !isWeekend) {
    const today = new Date();
    const dayIdx = today.getDay();
    if (dayIdx === 0) {
      isWeekend = true;
    } else {
      const daysArr: Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      day = daysArr[dayIdx - 1] ?? "Mon";
      dateStr = `${String(today.getDate()).padStart(2, "0")}-${String(today.getMonth() + 1).padStart(2, "0")}-${today.getFullYear()}`;
    }
  }

  return { dateStr: dateStr || "Specified Date", day, isWeekend };
}

type SnapshotRow = {
  coursecode: string;
  coursedesc: string | null;
  ltps: string | null;
  section: string;
  total_conducted: number;
  total_attended: number;
};

/** Calculate the exact attendance drop if classes on date/day are bunked. */
export async function calculateBunkDrop(
  query: string,
  db?: SupabaseClient,
  customTimetable?: Record<Day, Record<string, ClassSlot | null>>,
): Promise<BunkCalculationResult> {
  const { dateStr, day, isWeekend } = parseBunkQuery(query);

  if (isWeekend || !day) {
    return {
      input: query,
      dateStr,
      day: day ?? "Mon",
      isWeekend: true,
      totalPeriodsScheduled: 0,
      schedule: [],
      currentOverallPct: 0,
      newOverallPct: 0,
      overallDropPct: 0,
      coursesImpacted: [],
      usingBaseline: false,
      summary: `No classes scheduled on ${dateStr} (Sunday / Weekend). Attendance will not be affected.`,
    };
  }

  const timetable = customTimetable ?? TIMETABLE;
  const daySchedule = timetable[day] ?? {};

  // Find all scheduled periods for that day
  const schedule: { period: string; time: string; slot: ClassSlot }[] = [];
  const bunkedByComponent: Record<string, { baseCourse: string; type: string; count: number; section: string }> = {};

  for (const period of PERIODS) {
    if (period.isBreak) continue;
    const slot = daySchedule[period.key];
    if (slot && slot.coursecode) {
      const timeStr = `${Math.floor(period.start / 60)}:${String(period.start % 60).padStart(2, "0")}–${Math.floor(period.end / 60)}:${String(period.end % 60).padStart(2, "0")}`;
      schedule.push({ period: period.label, time: timeStr, slot });

      const { base, type } = splitCourse(slot.coursecode);
      const ltps = (type || "L").toUpperCase();
      const key = `${base}|${ltps}`;
      if (!bunkedByComponent[key]) {
        bunkedByComponent[key] = { baseCourse: base, type: ltps, count: 0, section: slot.section };
      }
      bunkedByComponent[key]!.count += 1;
    }
  }

  // Fetch live snapshots from Supabase if client provided
  let snapshotRows: SnapshotRow[] = [];
  let usingBaseline = false;

  if (db) {
    try {
      const { data } = await db.from("attendance_snapshot").select("*");
      if (data && data.length > 0) {
        snapshotRows = data as SnapshotRow[];
      }
    } catch (e) {
      console.warn("Could not query attendance_snapshot:", e);
    }
  }

  // If no rows found in DB, use baseline
  if (snapshotRows.length === 0) {
    usingBaseline = true;
    // Build realistic baseline for the courses in timetable
    const coursesInTimetable = new Set<string>();
    for (const d of DAYS) {
      for (const slot of Object.values(timetable[d])) {
        if (slot) {
          const { base, type } = splitCourse(slot.coursecode);
          coursesInTimetable.add(`${base}|${type || "L"}|${slot.section}`);
        }
      }
    }
    for (const item of coursesInTimetable) {
      const [coursecode, ltps, section] = item.split("|");
      snapshotRows.push({
        coursecode: coursecode!,
        coursedesc: coursecode!,
        ltps: ltps!,
        section: section!,
        total_conducted: 24,
        total_attended: 21, // ~87.5% baseline
      });
    }
  }

  // Calculate current and new attendance
  const byCourse = new Map<string, SnapshotRow[]>();
  for (const row of snapshotRows) {
    const list = byCourse.get(row.coursecode) ?? [];
    list.push(row);
    byCourse.set(row.coursecode, list);
  }

  let totalCurrentAttended = 0;
  let totalCurrentConducted = 0;
  let totalNewAttended = 0;
  let totalNewConducted = 0;

  for (const row of snapshotRows) {
    totalCurrentAttended += row.total_attended;
    totalCurrentConducted += row.total_conducted;
  }
  totalNewAttended = totalCurrentAttended;
  totalNewConducted = totalCurrentConducted + schedule.length;

  const currentOverallPct = totalCurrentConducted > 0 ? (totalCurrentAttended / totalCurrentConducted) * 100 : 0;
  const newOverallPct = totalNewConducted > 0 ? (totalNewAttended / totalNewConducted) * 100 : 0;
  const overallDropPct = Math.max(0, currentOverallPct - newOverallPct);

  // Per-course calculation
  const coursesImpacted: BunkCourseImpact[] = [];
  const coursesOnDay = new Set(Object.values(bunkedByComponent).map((b) => b.baseCourse));

  for (const coursecode of coursesOnDay) {
    const rows = byCourse.get(coursecode) ?? [];
    const desc = rows[0]?.coursedesc ?? coursecode;
    const componentsAffected: BunkCourseImpact["componentsAffected"] = [];

    let currentWeightedSum = 0;
    let currentWeightTotal = 0;
    let newWeightedSum = 0;
    let newWeightTotal = 0;
    let periodsForThisCourse = 0;

    // Check all components of this course
    const allCompCodes = new Set<string>(["L", "P", "T", "S"]);
    rows.forEach((r) => allCompCodes.add((r.ltps ?? "L").toUpperCase().slice(0, 1)));

    for (const cCode of allCompCodes) {
      const w = WEIGHTS[cCode] ?? 0.25;
      const row = rows.find((r) => (r.ltps ?? "").toUpperCase().slice(0, 1) === cCode);
      const bunkKey = `${coursecode}|${cCode}`;
      const missed = bunkedByComponent[bunkKey]?.count ?? 0;

      const currentConducted = row?.total_conducted ?? (missed > 0 ? 20 : 0);
      const currentAttended = row?.total_attended ?? (missed > 0 ? 18 : 0);
      const currentPct = currentConducted > 0 ? (currentAttended / currentConducted) * 100 : 0;

      const newConducted = currentConducted + missed;
      const newAttended = currentAttended; // didn't attend!
      const newPct = newConducted > 0 ? (newAttended / newConducted) * 100 : 0;
      const dropPct = currentPct - newPct;

      if (currentConducted > 0 || missed > 0) {
        currentWeightedSum += currentPct * w;
        currentWeightTotal += w;
        newWeightedSum += newPct * w;
        newWeightTotal += w;
      }

      if (missed > 0) {
        periodsForThisCourse += missed;
        componentsAffected.push({
          code: cCode,
          label: COMPONENT_LABELS[cCode] ?? cCode,
          missed,
          currentConducted,
          currentAttended,
          currentPct,
          newConducted,
          newAttended,
          newPct,
          dropPct,
        });
      }
    }

    const currentWeighted = currentWeightTotal > 0 ? currentWeightedSum / currentWeightTotal : 0;
    const newWeighted = newWeightTotal > 0 ? newWeightedSum / newWeightTotal : 0;
    const dropWeighted = currentWeighted - newWeighted;

    coursesImpacted.push({
      coursecode,
      coursedesc: desc,
      periodsBunked: periodsForThisCourse,
      componentsAffected,
      currentWeighted,
      newWeighted,
      dropWeighted,
      danger: newWeighted < 75,
      warning: newWeighted < 85 && newWeighted >= 75,
    });
  }

  coursesImpacted.sort((a, b) => b.dropWeighted - a.dropWeighted);

  const summary = `Bunking ${dateStr} (${day}) will drop overall attendance by ${overallDropPct.toFixed(2)}% (${currentOverallPct.toFixed(1)}% ➔ ${newOverallPct.toFixed(1)}%) across ${schedule.length} periods.`;

  return {
    input: query,
    dateStr,
    day,
    isWeekend: false,
    totalPeriodsScheduled: schedule.length,
    schedule,
    currentOverallPct,
    newOverallPct,
    overallDropPct,
    coursesImpacted,
    usingBaseline,
    summary,
  };
}

/** Format the calculation result into a clean, rich HTML message for Telegram. */
export function formatBunkTelegramHtml(res: BunkCalculationResult): string {
  if (res.isWeekend) {
    return `🏖️ <b>No Classes on ${res.dateStr} (${res.day})</b>\nIt's a weekend / holiday! Your attendance will not be affected.`;
  }

  let html = `🚨 <b>BUNK SIMULATION · ${res.dateStr} (${res.day})</b>\n\n`;
  html += `📊 <b>Overall Impact:</b>\n`;
  html += `• <b>${res.currentOverallPct.toFixed(1)}%</b> ➔ <b>${res.newOverallPct.toFixed(1)}%</b> (🔻 <b>-${res.overallDropPct.toFixed(2)}%</b>)\n`;
  html += `• Total Periods to miss: <b>${res.totalPeriodsScheduled} periods</b>\n\n`;

  html += `📚 <b>Subject-Wise Attendance Drop:</b>\n`;
  for (const c of res.coursesImpacted) {
    const alertIcon = c.danger ? "❌ CRITICAL (<75%)" : c.warning ? "⚠️ WARNING (<85%)" : "📉";
    html += `\n• <b>${c.coursecode}</b> (${c.periodsBunked} classes)\n`;
    html += `  Weighted: <b>${c.currentWeighted.toFixed(1)}%</b> ➔ <b>${c.newWeighted.toFixed(1)}%</b> (🔻 -${c.dropWeighted.toFixed(2)}%)\n`;
    for (const comp of c.componentsAffected) {
      html += `  ↳ <i>${comp.label} (${comp.code})</i>: ${comp.currentPct.toFixed(1)}% ➔ ${comp.newPct.toFixed(1)}% (-${comp.dropPct.toFixed(1)}%)\n`;
    }
    if (c.danger) html += `  🚨 <b>Warning: Drops below 75% attendance threshold!</b>\n`;
  }

  html += `\n⏰ <b>Classes Scheduled for ${res.day}:</b>\n`;
  for (const s of res.schedule) {
    html += `• <code>${s.period}</code> (${s.time}): <b>${s.slot.coursecode}</b> · ${s.slot.section} (Room: ${s.slot.room})\n`;
  }

  if (res.usingBaseline) {
    html += `\n<i>ℹ️ Calculated with default baseline (live ERP snapshot will calibrate automatically).</i>`;
  }

  return html;
}
