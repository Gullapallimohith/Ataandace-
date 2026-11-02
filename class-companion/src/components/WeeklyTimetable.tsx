import { useEffect, useMemo, useState } from "react";
import {
  PERIODS,
  TIMETABLE,
  DAYS,
  istNow,
  formatPeriodTime,
  splitCourse,
  courseColor,
  TYPE_LABELS,
  type Day,
} from "@/lib/timetable";

export function WeeklyTimetable() {
  const [now, setNow] = useState(() => istNow());
  const [timetable, setTimetable] = useState(TIMETABLE);

  useEffect(() => {
    const id = setInterval(() => setNow(istNow()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    import("@/integrations/supabase/client").then(({ supabase }) => {
      // Load stored timetable from Supabase
      supabase
        .from("timetable" as any)
        .select("data")
        .eq("id", 1)
        .maybeSingle()
        .then(({ data }) => {
          if (data && (data as any).data && Object.keys((data as any).data).length > 0) {
            setTimetable((data as any).data);
          }
        })
        .catch(() => {});

      // Subscribe to real-time changes
      const channel = supabase
        .channel("timetable_realtime")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "timetable" },
          (payload: any) => {
            if (payload?.new?.data && Object.keys(payload.new.data).length > 0) {
              setTimetable(payload.new.data);
            }
          },
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }).catch(() => {});
  }, []);

  const isLive = (day: Day, start: number, end: number) =>
    now.day === day && now.minutes >= start && now.minutes < end;

  const courses = useMemo(() => {
    const set = new Set<string>();
    for (const day of DAYS) {
      for (const slot of Object.values(timetable[day] ?? {})) {
        if (slot) set.add(splitCourse(slot.coursecode).base);
      }
    }
    return [...set].sort();
  }, [timetable]);

  return (
    <section className="panel overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
        <h2 className="text-lg font-semibold">Weekly Timetable</h2>
        <span className="text-xs text-muted-foreground">
          {now.day ? `Today is ${now.day}` : "No classes today"} · live period highlighted
        </span>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] border-collapse text-sm">
          <thead>
            <tr className="bg-primary/20">
              <th className="sticky left-0 z-10 bg-[#0b0b0b] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-primary">
                Day
              </th>
              {PERIODS.map((period) => (
                <th
                  key={period.key}
                  className={`px-2 py-3 text-left text-xs font-semibold uppercase tracking-wide text-primary/80 ${
                    period.isBreak ? "w-12" : ""
                  }`}
                >
                  <div>{period.label}</div>
                  <div className="text-[10px] font-normal normal-case text-muted-foreground">
                    {formatPeriodTime(period)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((day, rowIndex) => (
              <tr
                key={day}
                className={`border-t border-border/70 ${
                  now.day === day
                    ? "bg-primary/10"
                    : rowIndex % 2 === 1
                      ? "bg-secondary/30"
                      : ""
                }`}
              >
                <td className="sticky left-0 z-10 bg-[#0b0b0b] px-3 py-2 align-middle">
                  <span
                    className={`font-semibold ${now.day === day ? "text-primary" : ""}`}
                  >
                    {day}
                  </span>
                </td>
                {PERIODS.map((period) => {
                  if (period.isBreak) {
                    return (
                      <td
                        key={period.key}
                        className="px-1 py-2 text-center text-[10px] uppercase tracking-wide text-muted-foreground"
                      >
                        Break
                      </td>
                    );
                  }
                  const slot = timetable[day]?.[period.key];
                  const live = isLive(day, period.start, period.end);
                  if (!slot) {
                    return (
                      <td
                        key={period.key}
                        className="px-2 py-2 text-center text-xs text-muted-foreground/50"
                      >
                        -
                      </td>
                    );
                  }
                  const { base, type } = splitCourse(slot.coursecode);
                  const color = courseColor(slot.coursecode);
                  return (
                    <td key={period.key} className="px-1.5 py-2 align-top">
                      <div
                        className={`rounded-lg border px-2 py-1.5 ${
                          live
                            ? "border-primary bg-primary/15 shadow-[var(--shadow-glow)]"
                            : "border-border/70 bg-secondary/50"
                        }`}
                        style={{ borderLeft: `3px solid ${color}` }}
                      >
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] font-semibold leading-tight">
                            {base}
                          </span>
                          {type && (
                            <span
                              className="rounded px-1 text-[9px] font-bold"
                              style={{ background: `${color}33`, color }}
                            >
                              {type}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {slot.section} · {slot.room}
                        </div>
                        {slot.venue && (
                          <div className="text-[9px] text-muted-foreground/70">
                            {slot.venue}
                          </div>
                        )}
                        {live && (
                          <div className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-primary">
                            Live now
                          </div>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border px-5 py-4 text-[11px] text-muted-foreground">
        {courses.map((code) => (
          <span key={code} className="flex items-center gap-1.5">
            <span
              className="inline-block size-2.5 rounded-full"
              style={{ background: courseColor(`${code}-L`) }}
            />
            {code}
          </span>
        ))}
        <span className="mx-1 h-3 w-px bg-border" />
        {Object.entries(TYPE_LABELS).map(([key, label]) => (
          <span key={key}>
            <span className="font-bold text-foreground">{key}</span> = {label}
          </span>
        ))}
      </div>
    </section>
  );
}
