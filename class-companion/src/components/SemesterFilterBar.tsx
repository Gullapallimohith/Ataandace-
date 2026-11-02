import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

export const SEMESTER_OPTIONS = [
  { key: "2026-2027_odd", label: "2026 – 2027 · Odd Sem (Current)" },
  { key: "2025-2026_even", label: "2025 – 2026 · Even Sem" },
  { key: "2025-2026_odd", label: "2025 – 2026 · Odd Sem" },
  { key: "2024-2025_even", label: "2024 – 2025 · Even Sem" },
  { key: "2024-2025_odd", label: "2024 – 2025 · Odd Sem" },
];

type Props = {
  selectedSemester: string;
  onSemesterChange: (semesterKey: string) => void;
};

export function SemesterFilterBar({ selectedSemester, onSemesterChange }: Props) {
  const queryClient = useQueryClient();
  const [isSendingCaptcha, setIsSendingCaptcha] = useState(false);
  const [isSendingReport, setIsSendingReport] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [notification, setNotification] = useState<{ text: string; isError: boolean } | null>(null);

  const handleSendCaptcha = async () => {
    setIsSendingCaptcha(true);
    setNotification(null);
    try {
      const res = await fetch("/api/public/start-login", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setNotification({
          text: "📸 Login CAPTCHA sent to your Telegram bot (@SONXBOADBOT)! Reply to the image in Telegram with the code to verify.",
          isError: false,
        });
      } else {
        setNotification({
          text: data.message || "Could not load CAPTCHA. Check if ERP is reachable.",
          isError: true,
        });
      }
    } catch {
      setNotification({
        text: "Failed to connect to backend. Please try again.",
        isError: true,
      });
    } finally {
      setIsSendingCaptcha(false);
    }
  };

  const handleSendPresentStatus = async () => {
    setIsSendingReport(true);
    setNotification(null);
    try {
      const res = await fetch("/api/public/send-present-status", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setNotification({
          text: `📲 Real-time Present status & attendance report delivered to Telegram! (Overall: ${data.overall}%)`,
          isError: false,
        });
      } else {
        setNotification({
          text: data.error || "Failed to send message to Telegram. Check bot configuration.",
          isError: true,
        });
      }
    } catch {
      setNotification({
        text: "Could not send report to Telegram. Check internet connection.",
        isError: true,
      });
    } finally {
      setIsSendingReport(false);
    }
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    setNotification(null);
    try {
      const res = await fetch("/api/public/poll-attendance");
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["attendance_snapshot"] });
      queryClient.invalidateQueries({ queryKey: ["attendance_history"] });
      setNotification({
        text: data.ok
          ? "🔄 Attendance data checked and synced successfully!"
          : "Sync completed with local cached records.",
        isError: false,
      });
    } catch {
      setNotification({
        text: "Sync request failed. Using cached records.",
        isError: true,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const currentOption = SEMESTER_OPTIONS.find((s) => s.key === selectedSemester) ?? SEMESTER_OPTIONS[0]!;

  return (
    <section className="mt-4 bento p-4 sm:p-5 border border-border/70">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {/* Semester Filter Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
          <div className="flex items-center gap-2">
            <span className="flex size-2 rounded-full bg-primary" />
            <label htmlFor="semester-filter" className="label-caps text-xs">
              Semester Filter:
            </label>
          </div>
          <div className="relative">
            <select
              id="semester-filter"
              value={selectedSemester}
              onChange={(e) => onSemesterChange(e.target.value)}
              className="appearance-none rounded-lg border border-border bg-secondary/80 px-3.5 py-2 pr-9 font-mono text-xs font-semibold text-foreground hover:border-primary/50 focus:border-primary focus:outline-none transition-colors cursor-pointer"
            >
              {SEMESTER_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key} className="bg-background text-foreground">
                  🎓 {opt.label}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-muted-foreground text-xs">
              ▼
            </div>
          </div>
        </div>

        {/* Telegram Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleSendCaptcha}
            disabled={isSendingCaptcha}
            title="Request ERP login CAPTCHA image directly on your Telegram bot"
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3.5 py-2 font-mono text-xs font-bold text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
          >
            <span>📱</span>
            {isSendingCaptcha ? "Sending CAPTCHA…" : "Send CAPTCHA to Telegram"}
          </button>

          <button
            type="button"
            onClick={handleSendPresentStatus}
            disabled={isSendingReport}
            title="Send present classes & overall attendance summary to Telegram"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3.5 py-2 font-mono text-xs font-semibold text-foreground hover:bg-secondary/70 hover:border-border/80 transition-colors disabled:opacity-50"
          >
            <span>📲</span>
            {isSendingReport ? "Sending…" : "Send Present to Telegram"}
          </button>

          <button
            type="button"
            onClick={handleSyncNow}
            disabled={isSyncing}
            title="Poll KL University ERP for new attendance"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-3 py-2 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <span>🔄</span>
            {isSyncing ? "Syncing…" : "Sync"}
          </button>
        </div>
      </div>

      {/* Notification Toast Banner */}
      {notification && (
        <div
          className={`mt-3.5 flex items-center justify-between rounded-lg p-3 text-xs font-mono transition-all ${
            notification.isError
              ? "bg-destructive/15 text-destructive border border-destructive/30"
              : "bg-success/15 text-success border border-success/30"
          }`}
        >
          <span className="flex-1">{notification.text}</span>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="ml-3 text-xs opacity-70 hover:opacity-100 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Info sub-bar */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-2.5 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Active View:</span>
          <span className="font-semibold text-foreground">{currentOption.label}</span>
        </div>
        <div className="flex items-center gap-3">
          <span>Roll No: <code className="text-foreground">2420030663</code></span>
          <span>•</span>
          <span>Telegram Bot: <span className="text-primary font-semibold">@SONXBOADBOT</span></span>
        </div>
      </div>
    </section>
  );
}

