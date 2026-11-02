import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { WeeklyTimetable } from "@/components/WeeklyTimetable";
import { SyncToggle } from "@/components/SyncToggle";
import { AttendanceOverview, buildCourses, type Course } from "@/components/AttendanceOverview";
import { AttendanceLogList } from "@/components/AttendanceLogList";
import { BunkCalculator } from "@/components/BunkCalculator";
import { SemesterFilterBar, SEMESTER_OPTIONS } from "@/components/SemesterFilterBar";

import { useAttendanceData } from "@/hooks/useAttendanceData";
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

function SubjectCard({ course }: { course: Course }) {
  const low = course.weighted < LOW;
  const attended = course.components.reduce((s, c) => s + c.attended, 0);
  const conducted = course.components.reduce((s, c) => s + c.conducted, 0);

  return (
    <article className="bento p-5">
      <div className="flex items-center justify-between gap-1">
        <p className="label-caps truncate font-bold text-foreground">
          {course.coursecode}
        </p>
        {course.components.length > 0 && (
          <span className="num shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
            {course.components.map((c) => c.code).join("·")}
          </span>
        )}
      </div>
      <p className={`stat-big mt-2 text-3xl ${low ? "text-destructive" : ""}`}>
        {course.weighted.toFixed(1)}
        <span className="ml-0.5 align-top text-base">%</span>
      </p>
      <p className="mt-3 truncate text-xs text-muted-foreground" title={course.coursedesc}>
        {course.coursedesc || "—"}
      </p>
      <p className="num mt-1 text-xs text-muted-foreground">
        {attended} / {conducted}
      </p>
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={`h-full rounded-full transition-[width] duration-700 ${low ? "bg-destructive" : "bg-primary"}`}
          style={{ width: `${Math.min(course.weighted, 100)}%` }}
        />
      </div>
    </article>
  );
}

function Dashboard() {
  const [selectedSemester, setSelectedSemester] = useState("2026-2027_odd");
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
          <div className="mb-3 flex items-center justify-between">
            <h2 className="label-caps">Per Subject</h2>
            <span className="text-xs text-muted-foreground">
              {courses.length} subjects · LTPS Weighted
            </span>
          </div>
          {snapshots.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading subjects…</p>
          ) : courses.length === 0 ? (
            <p className="bento p-6 text-sm text-muted-foreground">
              No attendance synced yet. Subjects appear here once the ERP session is active.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {courses.map((course) => (
                <SubjectCard key={course.coursecode} course={course} />
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
