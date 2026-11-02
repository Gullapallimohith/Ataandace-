import { useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import type { HistoryEntry } from "@/hooks/useAttendanceData";

function StatusLabel({ status }: { status: string }) {
  const present = status.toLowerCase() === "present";
  return (
    <span
      className={`num shrink-0 text-xs font-bold uppercase tracking-widest ${
        present ? "text-success" : "text-destructive"
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
  const [isSending, setIsSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const handleSendToTelegram = async () => {
    setIsSending(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/public/send-present-status", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setStatusMsg("✅ Present messages sent to your Telegram bot!");
        setTimeout(() => setStatusMsg(null), 5000);
      } else {
        setStatusMsg("⚠️ Could not send to Telegram.");
      }
    } catch {
      setStatusMsg("⚠️ Connection failed.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section className="relative mt-10">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="label-caps">Attendance Log</h2>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSendToTelegram}
            disabled={isSending}
            title="Dispatch present class alerts directly to your Telegram bot"
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1 font-mono text-xs font-semibold text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
          >
            <Send className="size-3" />
            {isSending ? "Sending Present Logs…" : "Send Present to Telegram"}
          </button>
          <span className="label-caps text-muted-foreground">
            {entries.length} record{entries.length === 1 ? "" : "s"}
          </span>
        </div>
      </header>

      {statusMsg && (
        <div className="mb-3 rounded-lg border border-success/30 bg-success/15 p-2.5 font-mono text-xs text-success">
          {statusMsg}
        </div>
      )}

      <div className="relative rounded-[20px] border border-border bg-background">
        {isLoading ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">Loading log…</p>
        ) : entries.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            No class records yet — entries appear as periods get marked.
          </p>
        ) : (
          <ul className="log-scroll max-h-[520px] overflow-y-auto">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex min-h-[64px] items-center justify-between gap-4 border-b border-[#1a1a1a] px-5 py-4 last:border-b-0"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm text-muted-foreground">
                    {entry.coursedesc || entry.coursecode}
                    {entry.section ? ` · ${entry.section}` : ""}
                  </span>
                  <span className="num mt-1 block text-[11px] text-muted-foreground/70">
                    {entry.date} {entry.note ? `• ${entry.note}` : ""}
                  </span>
                </span>
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
