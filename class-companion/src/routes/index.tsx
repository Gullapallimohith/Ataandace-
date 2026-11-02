import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { WeeklyTimetable } from "@/components/WeeklyTimetable";
import { SyncToggle } from "@/components/SyncToggle";
import { AttendanceOverview, buildCourses } from "@/components/AttendanceOverview";
import { AttendanceLogList } from "@/components/AttendanceLogList";
import { BunkCalculator } from "@/components/BunkCalculator";
import { SemesterFilterBar, SEMESTER_OPTIONS } from "@/components/SemesterFilterBar";

import { useAttendanceData, type Snapshot } from "@/hooks/useAttendanceData";
import { useSyncSetting } from "@/hooks/useSyncSetting";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Class Companion — Live Attendance Dashboard" },
      {
        name: "description",
        content:
          "Track KL University attendance live: overall percentage, per-subject stats, weekly timetable and class history.",
      },
      { property: "og:title", content: "Class Companion — Live Attendance Dashboard" },
      {
        property: "og:description",
        content:
          "Track KL University attendance live: overall percentage, per-subject stats, weekly timetable and class history.",
      },
    ],
  }),
  component: Dashboard,
});

function pct(attended: number, conducted: number) {
  if (!conducted) return 0;
  return Math.round((attended / conducted) * 1000) / 10;
}

const LOW = 75;

function OverallHero({
  value,
  attended,
  conducted,
  updatedAt,
}: {
  value: number;
  attended: number;
  conducted: number;
  updatedAt: string | null;
}) {
  const missed = Math.max(conducted - attended, 0);
  const low = value < LOW;

  return (
    <section className="relative mt-8 overflow-hidden bento p-6 sm:p-8">
      <div
        className="pointer-events-none absolute -right-16 -top-24 size-64 rounded-full opacity-25 blur-3xl"
        style={{ background: "var(--color-success)" }}
        aria-hidden
      />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="label-caps">Overall Attendance</p>
          <p
            className={`num mt-3 text-[56px] leading-none ${low ? "text-destructive" : "text-success"}`}
          >
            {value.toFixed(1)}
            <span className="text-2xl">%</span>
          </p>
          <p className="num mt-3 text-xs font-normal text-muted-foreground">
            <span className="font-bold text-foreground">{attended}</span> attended of{" "}
            <span className="font-bold text-foreground">{conducted}</span> conducted ·{" "}
            <span className="font-bold text-foreground">{missed}</span> missed
          </p>
        </div>
        <div className="text-right">
          <p className="label-caps">Last synced</p>
          <p className="num mt-2 text-xs text-muted-foreground">
            {updatedAt
              ? new Date(updatedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
              : "—"}
          </p>
        </div>
      </div>
      <div className="relative mt-6 h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-warning transition-[width] duration-700"
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </section>
  );
}

const COMPONENT_META: Record<string, { label: string; full: string; badge: string }> = {
  L: { label: "L", full: "Lecture", badge: "bg-blue-500/15 text-blue-400 border border-blue-500/30" },
  P: { label: "P", full: "Practical", badge: "bg-purple-500/15 text-purple-400 border border-purple-500/30" },
  T: { label: "T", full: "Tutorial", badge: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" },
  S: { label: "S", full: "Skill", badge: "bg-amber-500/15 text-amber-400 border border-amber-500/30" },
};

function ComponentCard({ row }: { row: Snapshot }) {
  const code = (row.ltps ?? "L").trim().toUpperCase().slice(0, 1);
  const meta = COMPONENT_META[code] ?? {
    label: code || "L",
    full: "Class",
    badge: "bg-secondary text-foreground border border-border",
  };
  const value = pct(row.total_attended, row.total_conducted);
  const low = value < LOW;

  return (
    <article className="bento p-5 relative overflow-hidden transition-all hover:border-primary/40">
      <div className="flex items-center justify-between gap-1.5">
        <p className="label-caps font-bold text-foreground truncate">
          {row.coursecode}
        </p>
        <span className={`num shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.badge}`}>
          {meta.full} · {meta.label}
        </span>
      </div>

      <p className={`stat-big mt-2 text-3xl font-bold ${low ? "text-destructive" : "text-success"}`}>
        {value.toFixed(1)}
        <span className="ml-0.5 align-top text-base">%</span>
      </p>

      <p className="mt-2.5 truncate text-xs text-foreground/90 font-medium" title={row.coursedesc}>
        {row.coursedesc || row.section}
      </p>

      <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
        <span className="num font-mono">{row.total_attended} / {row.total_conducted}</span>
        <span className="num text-[11px] truncate">{row.section || "—"}</span>
      </div>

      <div className="mt-3.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={`h-full rounded-full transition-[width] duration-700 ${low ? "bg-destructive" : "bg-primary"}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </article>
  );
}

function Dashboard() {
  const [selectedSemester, setSelectedSemester] = useState("2026-2027_odd");
  const [ltpsFilter, setLtpsFilter] = useState<"ALL" | "L" | "P" | "T" | "S">("ALL");
  const { enabled, isPending, setEnabled } = useSyncSetting();
  const { snapshots, history } = useAttendanceData(enabled, selectedSemester);
  const rows = snapshots.data ?? [];

  const conducted = rows.reduce((sum, r) => sum + r.total_conducted, 0);
  const attended = rows.reduce((sum, r) => sum + r.total_attended, 0);
  const absent = Math.max(conducted - attended, 0);

  const courses = buildCourses(rows);
  const overall = courses.length > 0
    ? courses.reduce((sum, c) => sum + c.weighted, 0) / courses.length
    : pct(attended, conducted);

  const lCount = rows.filter((r) => (r.ltps ?? "").trim().toUpperCase().slice(0, 1) === "L").length;
  const pCount = rows.filter((r) => (r.ltps ?? "").trim().toUpperCase().slice(0, 1) === "P").length;
  const tCount = rows.filter((r) => (r.ltps ?? "").trim().toUpperCase().slice(0, 1) === "T").length;
  const sCount = rows.filter((r) => (r.ltps ?? "").trim().toUpperCase().slice(0, 1) === "S").length;

  const filteredRows = ltpsFilter === "ALL"
    ? rows
    : rows.filter((r) => (r.ltps ?? "").trim().toUpperCase().slice(0, 1) === ltpsFilter);

  const lastSynced = enabled
    ? rows.reduce<string | null>(
      (latest, r) => (!latest || r.updated_at > latest ? r.updated_at : latest),
      null,
    )
    : null;

  const currentOption =
    SEMESTER_OPTIONS.find((s) => s.key === selectedSemester) ?? SEMESTER_OPTIONS[0]!;

  return (
    <>
      <div className="h-[3px] w-full bg-primary" />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[32px] font-bold leading-none">
              Class <span className="text-primary">Companion</span>
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <p className="label-caps">KL University</p>
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                Year {currentOption.label.replace(" (Current)", "")}
              </span>
            </div>
          </div>
          <SyncToggle enabled={enabled} isPending={isPending} onChange={setEnabled} />
        </header>

        <SemesterFilterBar
          selectedSemester={selectedSemester}
          onSemesterChange={setSelectedSemester}
        />

        <OverallHero
          value={overall}
          attended={attended}
          conducted={conducted}
          updatedAt={lastSynced}
        />

        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="label-caps font-bold">L · T · P · S Components (Separate)</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Every Lecture, Tutorial, Practical & Skill class tracked individually
              </p>
            </div>

            {/* Quick Filter Pill Buttons */}
            <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-secondary/30 p-1">
              <button
                type="button"
                onClick={() => setLtpsFilter("ALL")}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                  ltpsFilter === "ALL"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All ({rows.length})
              </button>
              <button
                type="button"
                onClick={() => setLtpsFilter("L")}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                  ltpsFilter === "L"
                    ? "bg-blue-500 text-white shadow-sm"
                    : "text-blue-400 hover:text-blue-300"
                }`}
              >
                Lecture ({lCount})
              </button>
              <button
                type="button"
                onClick={() => setLtpsFilter("P")}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                  ltpsFilter === "P"
                    ? "bg-purple-500 text-white shadow-sm"
                    : "text-purple-400 hover:text-purple-300"
                }`}
              >
                Practical ({pCount})
              </button>
              <button
                type="button"
                onClick={() => setLtpsFilter("T")}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                  ltpsFilter === "T"
                    ? "bg-emerald-500 text-white shadow-sm"
                    : "text-emerald-400 hover:text-emerald-300"
                }`}
              >
                Tutorial ({tCount})
              </button>
              <button
                type="button"
                onClick={() => setLtpsFilter("S")}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                  ltpsFilter === "S"
                    ? "bg-amber-500 text-white shadow-sm"
                    : "text-amber-400 hover:text-amber-300"
                }`}
              >
                Skill ({sCount})
              </button>
            </div>
          </div>

          {snapshots.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading components…</p>
          ) : filteredRows.length === 0 ? (
            <p className="bento p-6 text-sm text-muted-foreground">
              No classes found for the selected filter.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {filteredRows.map((row) => (
                <ComponentCard key={`${row.coursecode}-${row.section}-${row.ltps}`} row={row} />
              ))}
            </div>
          )}
        </section>

        <section
          className="mt-6 grid grid-cols-3 gap-4 bento p-6"
        >
          <div>
            <p className="label-caps">Conducted</p>
            <p className="num mt-1 text-xl text-foreground">{conducted}</p>
          </div>
          <div>
            <p className="label-caps">Attended</p>
            <p className="num mt-1 text-xl text-primary">{attended}</p>
          </div>
          <div>
            <p className="label-caps">Absent</p>
            <p className="num mt-1 text-xl text-destructive">{absent}</p>
          </div>
        </section>

        <AttendanceOverview
          rows={rows}
          isLoading={snapshots.isLoading}
          isFetching={snapshots.isFetching}
          updatedAt={
            rows.reduce<string | null>(
              (latest, r) => (!latest || r.updated_at > latest ? r.updated_at : latest),
              null,
            )
          }
        />

        <div className="mt-10">
          <WeeklyTimetable />
        </div>

        <BunkCalculator />

        <AttendanceLogList entries={history.data ?? []} isLoading={history.isLoading} />

      </main>
    </>
  );
}
