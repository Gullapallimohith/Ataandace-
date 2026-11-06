import { useState } from "react";
import { MessageSquare, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { HistoryEntry } from "@/hooks/useAttendanceData";

function StatusLabel({ status }: { status: string }) {
  const present = status.toLowerCase() === "present";
  return (
    <span
      className={`num shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
        present
          ? "bg-success/15 text-success border border-success/30"
          : "bg-destructive/15 text-destructive border border-destructive/30"
      }`}
    >
      {present ? "Present" : "Absent"}
    </span>
  );
}

export function AttendanceLogList({
  entries,
  isLoading,
}: {
  entries: HistoryEntry[];
  isLoading: boolean;
}) {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["attendance_history"] }),
        queryClient.invalidateQueries({ queryKey: ["attendance_snapshot"] }),
      ]);
      await queryClient.refetchQueries({ queryKey: ["attendance_history"] });
    } catch {}
    setTimeout(() => setIsRefreshing(false), 600);
  };

  return (
    <section className="relative mt-10">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="label-caps font-bold">Attendance Log</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time history of classes marked present & absent
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            title="Refresh attendance logs now"
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary/50 px-2.5 py-1 font-mono text-xs font-medium text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`size-3 ${isRefreshing ? "animate-spin text-primary" : ""}`} />
            Refresh
          </button>
          <span className="label-caps text-muted-foreground ml-1">
            {entries.length} record{entries.length === 1 ? "" : "s"}
          </span>
        </div>
      </header>

      <div className="relative rounded-[20px] border border-border bg-background">
        {isLoading ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">Loading recent logs…</p>
        ) : entries.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            No class records yet — entries appear as periods get marked in ERP.
          </p>
        ) : (
          <ul className="log-scroll max-h-[520px] overflow-y-auto divide-y divide-border/40">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex min-h-[64px] items-center justify-between gap-4 px-5 py-3.5 hover:bg-secondary/20 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">
                      {entry.coursedesc || entry.coursecode}
                    </span>
                    <span className="num shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                      {entry.coursecode}
                    </span>
                    {entry.section && entry.section !== entry.coursecode && (
                      <span className="num shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-mono text-primary font-medium">
                        {entry.section}
                      </span>
                    )}
                  </div>
                  <div className="num mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="font-mono text-foreground/80">{entry.date}</span>
                    {entry.note && (
                      <>
                        <span>•</span>
                        <span className="text-muted-foreground">{entry.note}</span>
                      </>
                    )}
                  </div>
                </div>
                <StatusLabel status={entry.status} />
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          aria-label="Notes and comments"
          className="absolute -bottom-5 left-4 flex size-11 items-center justify-center rounded-full border border-border bg-secondary text-foreground shadow-lg transition-colors hover:bg-secondary/70"
        >
          <MessageSquare className="size-4" aria-hidden />
        </button>
      </div>
    </section>
  );
}
