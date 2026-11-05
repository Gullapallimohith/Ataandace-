import { createFileRoute } from "@tanstack/react-router";
import fs from "node:fs";
import path from "node:path";

const TMP_SENT_FILE = fs.existsSync("/tmp")
  ? path.join("/tmp", ".sent-period-reminders.json")
  : path.join(process.cwd(), ".sent-period-reminders.json");

function getSentAlerts(): Set<string> {
  try {
    if (fs.existsSync(TMP_SENT_FILE)) {
      const data = JSON.parse(fs.readFileSync(TMP_SENT_FILE, "utf-8"));
      if (Array.isArray(data)) return new Set(data);
    }
  } catch {}
  return new Set();
}

function recordSentAlert(key: string) {
  try {
    const alerts = getSentAlerts();
    alerts.add(key);
    const list = Array.from(alerts).slice(-60);
    fs.writeFileSync(TMP_SENT_FILE, JSON.stringify(list), "utf-8");
  } catch {}
}

const runnerHandler = async () => {
  const {
    admin,
    getSession,
    saveSession,
    sendTelegram,
    startErpLogin,
    fetchAttendanceHtml,
    parseAttendanceTable,
    isSupabaseConfigured,
    isSyncEnabled,
    checkAndNotifyAttendanceChanges,
    sendWeeklyAttendanceReport,
  } = await import("@/lib/erp.server");
  const { PERIODS, istNow, getTimetable } = await import("@/lib/timetable");

  const db = isSupabaseConfigured() ? admin() : null;
  const syncActive = await isSyncEnabled(db);

  const { day, minutes, timeString } = istNow();
  const results: Record<string, any> = {
    day,
    time: timeString,
    syncActive,
    notified: null,
    attendance: null,
  };

  if (!syncActive) {
    return Response.json({ ok: true, skipped: "sync disabled", ...results });
  }

  // 1. Timetable Reminders (10m before & at start time)
  if (day && day !== "Sun") {
    try {
      const timetable = await getTimetable(db);
      const sentAlerts = getSentAlerts();

      for (const period of PERIODS) {
        if (period.isBreak) continue;
        const slot = timetable[day]?.[period.key];
        if (!slot) continue;

        const alert10mKey = `10m_${day}_${period.key}`;
        const alertNowKey = `now_${day}_${period.key}`;

        // 10-Minute Reminder Window
        if (minutes >= period.start - 10 && minutes < period.start) {
          if (!sentAlerts.has(alert10mKey)) {
            const venueInfo = slot.venue ? ` (${slot.venue})` : "";
            await sendTelegram(
              `📚 Period ${period.label.replace("P", "")} starting in 10 mins: ${slot.coursecode} · ${slot.section} · Room ${slot.room}${venueInfo}`
            );
            recordSentAlert(alert10mKey);
            results.notified = `${period.key}_10m`;
            break;
          }
        }

        // At Start Window (first 5 minutes of period)
        if (minutes >= period.start && minutes <= period.start + 5) {
          if (!sentAlerts.has(alertNowKey)) {
            const venueInfo = slot.venue ? ` (${slot.venue})` : "";
            await sendTelegram(
              `📚 Period ${period.label.replace("P", "")} starting now: ${slot.coursecode} · ${slot.section} · Room ${slot.room}${venueInfo}`
            );
            recordSentAlert(alertNowKey);
            results.notified = `${period.key}_now`;
            break;
          }
        }
      }
    } catch (err: any) {
      results.timetableError = err.message;
    }
  }

  // 2. Sunday 9:00 AM IST Weekly Report Check
  if (day === "Sun" && minutes >= 9 * 60 && minutes < 9 * 60 + 10) {
    const weeklyKey = `weekly_report_${new Date().toISOString().slice(0, 10)}`;
    const sentAlerts = getSentAlerts();
    if (!sentAlerts.has(weeklyKey)) {
      try {
        await sendWeeklyAttendanceReport();
        recordSentAlert(weeklyKey);
        results.weeklyReportSent = true;
      } catch (err: any) {
        results.weeklyError = err.message;
      }
    }
  }

  // 3. Attendance Polling from KL University ERP
  try {
    const session = await getSession(db);
    if (!session || session.status !== "active" || !session.cookies) {
      if (session?.status !== "waiting_captcha") {
        const loginRes = await startErpLogin();
        results.attendance = { ok: false, error: "session not active", loginPrompted: loginRes.ok };
      } else {
        results.attendance = { ok: false, error: "waiting for captcha reply in telegram" };
      }
    } else {
      const { html, cookies, ok } = await fetchAttendanceHtml(session.cookies);
      if (!ok) {
        await saveSession(db, { status: "expired" });
        await startErpLogin();
        results.attendance = { ok: false, session: "expired", renewed: true };
      } else {
        if (cookies && cookies !== session.cookies) {
          await saveSession(db, { cookies });
        }
        const rows = parseAttendanceTable(html);
        if (rows.length > 0) {
          const { changes } = await checkAndNotifyAttendanceChanges(rows, db);
          results.attendance = {
            ok: true,
            parsed: rows.length,
            changesCount: changes.length,
            changes,
          };
        } else {
          results.attendance = { ok: true, parsed: 0 };
        }
      }
    }
  } catch (err: any) {
    results.attendance = { ok: false, error: err.message };
  }

  return Response.json({ ok: true, ...results });
};

export const Route = createFileRoute("/api/public/cloud-runner")({
  server: { handlers: { GET: runnerHandler, POST: runnerHandler } },
});
