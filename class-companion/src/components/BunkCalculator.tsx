import { useState, useEffect } from "react";
import { DAYS, type Day } from "@/lib/timetable";
import { calculateBunkDrop, type BunkCalculationResult } from "@/lib/bunk-calculator";
import { supabase } from "@/integrations/supabase/client";

export function BunkCalculator() {
  const [query, setQuery] = useState("");
  const [selectedDay, setSelectedDay] = useState<Day | "">("");
  const [result, setResult] = useState<BunkCalculationResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Set default query to tomorrow or next class day
  useEffect(() => {
    const today = new Date();
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const dayStr = `${String(tomorrow.getDate()).padStart(2, "0")}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${tomorrow.getFullYear()}`;
    const dayIdx = tomorrow.getDay();
    const dayName = dayIdx === 0 ? "Mon" : DAYS[dayIdx - 1] ?? "Mon";
    setQuery(`${dayStr} ${dayName}`);
    runCalculation(`${dayStr} ${dayName}`);
  }, []);

  const runCalculation = async (inputQuery: string) => {
    setIsCalculating(true);
    try {
      // Query supabase if available
      const res = await calculateBunkDrop(inputQuery, supabase as any);
      setResult(res);
    } catch (err) {
      console.error("Bunk calculation failed:", err);
    } finally {
      setIsCalculating(false);
    }
  };

  const handleDayQuickPick = (day: Day) => {
    setSelectedDay(day);
    const today = new Date();
    const dayIdx = today.getDay();
    const targetIdx = DAYS.indexOf(day) + 1; // 1-indexed (1=Mon)
    let diff = (targetIdx - dayIdx + 7) % 7;
    if (diff === 0) diff = 7; // next week same day
    const targetDate = new Date(today.getTime() + diff * 24 * 60 * 60 * 1000);
    const dStr = `${String(targetDate.getDate()).padStart(2, "0")}-${String(targetDate.getMonth() + 1).padStart(2, "0")}-${targetDate.getFullYear()}`;
    const fullQuery = `${dStr} ${day}`;
    setQuery(fullQuery);
    runCalculation(fullQuery);
  };

  return (
    <section className="bento mt-10 p-6 sm:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🧮</span>
            <h2 className="text-lg font-bold tracking-wide text-foreground">
              Bunk Attendance Simulator
            </h2>
            <span className="rounded-full bg-primary/20 px-2.5 py-0.5 text-[10px] font-semibold text-primary">
              KL ERP L-T-P-S Algorithm
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Type <code>/bunk dd-mm-yyyy day</code> or click a day to calculate how much percentage you will lose.
          </p>
        </div>
      </header>

      {/* Input row & quick day buttons */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <span className="absolute left-3 top-2.5 font-mono text-xs text-muted-foreground">
            /bunk
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runCalculation(query)}
            placeholder="28-10-2026 Tuesday"
            className="w-full rounded-lg border border-border bg-secondary/50 py-2 pl-16 pr-3 font-mono text-sm text-foreground focus:border-primary focus:outline-none"
          />
        </div>
        <button
          onClick={() => runCalculation(query)}
          disabled={isCalculating}
          className="rounded-lg bg-primary px-4 py-2 font-mono text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isCalculating ? "Calculating..." : "Calculate Drop"}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="label-caps mr-1 text-[10px]">Quick Select:</span>
        {DAYS.map((d) => (
          <button
            key={d}
            onClick={() => handleDayQuickPick(d)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              selectedDay === d
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      {/* Simulation Result */}
      {result && (
        <div className="mt-6 space-y-6">
          {result.isWeekend ? (
            <div className="rounded-xl border border-border bg-secondary/30 p-5 text-center">
              <p className="text-2xl">🏖️</p>
              <h3 className="mt-2 text-sm font-bold text-foreground">
                No Classes on {result.dateStr} ({result.day})
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                It's a weekend or holiday. Attendance will not be affected!
              </p>
            </div>
          ) : (
            <>
              {/* Overall impact hero */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-border bg-secondary/30 p-4">
                  <p className="label-caps text-[10px]">Current Overall</p>
                  <p className="num mt-1 text-2xl font-bold text-foreground">
                    {result.currentOverallPct.toFixed(1)}%
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-secondary/30 p-4">
                  <p className="label-caps text-[10px]">Projected if Bunked</p>
                  <p className="num mt-1 text-2xl font-bold text-warning">
                    {result.newOverallPct.toFixed(1)}%
                  </p>
                </div>
                <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4">
                  <p className="label-caps text-[10px] text-destructive">Total Attendance Drop</p>
                  <p className="num mt-1 text-2xl font-bold text-destructive">
                    -{result.overallDropPct.toFixed(2)}%
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Across {result.totalPeriodsScheduled} scheduled periods
                  </p>
                </div>
              </div>

              {/* Subject Breakdown */}
              <div>
                <h3 className="label-caps mb-3">Impact per Subject</h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {result.coursesImpacted.map((c) => (
                    <div
                      key={c.coursecode}
                      className={`rounded-lg border p-4 ${
                        c.danger
                          ? "border-destructive/60 bg-destructive/10"
                          : c.warning
                            ? "border-warning/50 bg-warning/5"
                            : "border-border bg-secondary/20"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="num text-sm font-bold text-foreground">
                            {c.coursecode}
                          </h4>
                          <p className="text-[10px] text-muted-foreground">
                            {c.periodsBunked} classes missed on {result.day}
                          </p>
                        </div>
                        <span
                          className={`num text-sm font-bold ${
                            c.danger ? "text-destructive" : "text-primary"
                          }`}
                        >
                          -{c.dropWeighted.toFixed(2)}%
                        </span>
                      </div>

                      <div className="mt-3 flex items-center justify-between text-xs font-mono">
                        <span className="text-muted-foreground">
                          {c.currentWeighted.toFixed(1)}%
                        </span>
                        <span className="text-muted-foreground">➔</span>
                        <span
                          className={`font-bold ${
                            c.danger ? "text-destructive" : "text-foreground"
                          }`}
                        >
                          {c.newWeighted.toFixed(1)}%
                        </span>
                      </div>

                      {/* Component breakdown */}
                      <div className="mt-3 space-y-1 border-t border-border/60 pt-2">
                        {c.componentsAffected.map((comp) => (
                          <div
                            key={comp.code}
                            className="flex items-center justify-between text-[11px] text-muted-foreground"
                          >
                            <span>
                              {comp.label} ({comp.code}) × {comp.missed}
                            </span>
                            <span className="font-mono text-destructive">
                              {comp.currentPct.toFixed(1)}% ➔ {comp.newPct.toFixed(1)}% (-
                              {comp.dropPct.toFixed(1)}%)
                            </span>
                          </div>
                        ))}
                      </div>

                      {c.danger && (
                        <p className="mt-2 text-[10px] font-bold text-destructive">
                          ⚠️ CRITICAL: Drops below 75% required attendance!
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Day's period schedule */}
              <div className="rounded-lg border border-border bg-secondary/10 p-4">
                <h4 className="label-caps mb-2 text-[10px]">
                  Scheduled Classes for {result.day} ({result.dateStr})
                </h4>
                <div className="flex flex-wrap gap-2">
                  {result.schedule.map((s) => (
                    <div
                      key={s.period}
                      className="rounded bg-secondary px-2.5 py-1 text-xs font-mono text-muted-foreground"
                    >
                      <span className="font-bold text-foreground">{s.period}</span> ({s.time}):{" "}
                      <span className="text-primary">{s.slot.coursecode}</span> · {s.slot.section} (
                      {s.slot.room})
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
