import type { Snapshot } from "@/hooks/useAttendanceData";

const WEIGHTS: Record<string, number> = { L: 1, P: 0.5, T: 0.25, S: 0.25 };
const LABELS: Record<string, string> = {
  L: "Lecture",
  P: "Practical",
  T: "Tutorial",
  S: "Skill",
};
const ORDER = ["L", "T", "P", "S"];

type Component = {
  code: string;
  label: string;
  section: string;
  percent: number;
  conducted: number;
  attended: number;
};

export type Course = {
  coursecode: string;
  coursedesc: string;
  components: Component[];
  weighted: number;
};

function tone(value: number) {
  if (value < 70) return "text-destructive";
  if (value < 85) return "text-primary";
  return "text-success";
}

function ringColor(value: number) {
  if (value < 70) return "var(--color-destructive)";
  if (value < 85) return "var(--color-primary)";
  return "var(--color-success)";
}

export function buildCourses(rows: Snapshot[]): Course[] {
  const byCourse = new Map<string, Snapshot[]>();
  for (const row of rows) {
    const list = byCourse.get(row.coursecode) ?? [];
    list.push(row);
    byCourse.set(row.coursecode, list);
  }

  const courses: Course[] = [];
  for (const [coursecode, list] of byCourse) {
    const components: Component[] = [];
    for (const row of list) {
      const code = (row.ltps ?? "").trim().toUpperCase().slice(0, 1);
      if (!WEIGHTS[code]) continue;
      // Exclude components with no conducted classes from the weighted calc.
      if (!row.total_conducted) continue;
      components.push({
        code,
        label: LABELS[code] ?? code,
        section: row.section,
        percent: (row.total_attended / row.total_conducted) * 100,
        conducted: row.total_conducted,
        attended: row.total_attended,
      });
    }
    components.sort((a, b) => ORDER.indexOf(a.code) - ORDER.indexOf(b.code));

    const weightSum = components.reduce((s, c) => s + (WEIGHTS[c.code] ?? 0), 0);
    const weighted = weightSum
      ? components.reduce((s, c) => s + c.percent * (WEIGHTS[c.code] ?? 0), 0) / weightSum
      : 0;

    courses.push({
      coursecode,
      coursedesc: list.find((r) => r.coursedesc)?.coursedesc ?? "",
      components,
      weighted,
    });
  }

  return courses.sort((a, b) => a.coursecode.localeCompare(b.coursecode));
}

function Badge({ value }: { value: number }) {
  const size = 62;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const rounded = Math.round(value);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-secondary)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={ringColor(value)}
          strokeWidth={stroke}
          strokeDasharray={`${(Math.min(rounded, 100) / 100) * c} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span
        className={`num absolute inset-0 flex items-center justify-center text-sm font-bold ${tone(value)}`}
      >
        {rounded}%
      </span>
    </div>
  );
}

function CourseCard({ course }: { course: Course }) {
  const attended = course.components.reduce((s, c) => s + c.attended, 0);
  const conducted = course.components.reduce((s, c) => s + c.conducted, 0);

  return (
    <article className="bento px-5 py-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="num text-sm font-bold tracking-wide text-foreground">
            {course.coursecode}
            {course.components.length > 0 && (
              <span className="num ml-2 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-normal text-muted-foreground">
                {course.components.map((c) => c.code).join("·")}
              </span>
            )}
          </h3>
          <p className={`num mt-3 text-[2.5rem] leading-none ${tone(course.weighted)}`}>
            {course.weighted.toFixed(1)}
            <span className="text-lg">%</span>
          </p>
          <p className="label-caps mt-3 truncate">{course.coursedesc || "—"}</p>
          <p className="num mt-1 text-[0.8rem] font-normal text-muted-foreground">
            {attended} / {conducted}
          </p>
        </div>
        <Badge value={course.weighted} />
      </div>

      <ul className="mt-4 space-y-2 border-t border-border pt-3">
        {course.components.length === 0 ? (
          <li className="text-xs text-muted-foreground">No classes conducted yet.</li>
        ) : (
          course.components.map((c) => (
            <li key={c.code + c.section} className="flex items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="block truncate text-xs font-bold text-foreground">{c.label}</span>
                <span className="num block text-[10px] font-normal text-muted-foreground">
                  {c.section} · {c.attended}/{c.conducted}
                </span>
              </span>
              <span
                className={`num rounded-full bg-secondary px-2 py-0.5 text-[10px] ${tone(c.percent)}`}
              >
                {Math.round(c.percent)}%
              </span>
            </li>
          ))
        )}
      </ul>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <span className="label-caps">Weighted Overall</span>
        <span className={`num text-xl ${tone(course.weighted)}`}>
          {course.weighted.toFixed(1)}%
        </span>
      </div>
    </article>
  );
}

export function AttendanceOverview({
  rows,
  isLoading,
  isFetching,
  updatedAt,
}: {
  rows: Snapshot[];
  isLoading: boolean;
  isFetching: boolean;
  updatedAt: string | null;
}) {
  const courses = buildCourses(rows);

  return (
    <section className="mt-10">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="label-caps">Attendance Overview · L-T-P-S</h2>
        <span className="label-caps flex items-center gap-2 text-muted-foreground">
          {isFetching && (
            <span className="size-2 animate-pulse rounded-full bg-primary" aria-hidden />
          )}
          synced automatically
          {updatedAt && (
            <span className="num normal-case">
              · {new Date(updatedAt).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}
            </span>
          )}
        </span>
      </header>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-52 animate-pulse bento" />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <p className="bento p-6 text-sm text-muted-foreground">
          No courses synced yet — cards appear once attendance data arrives.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <CourseCard key={course.coursecode} course={course} />
          ))}
        </div>
      )}
    </section>
  );
}
