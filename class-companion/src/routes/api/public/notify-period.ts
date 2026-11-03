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
    // keep only last 50 keys to prevent file bloat
    const list = Array.from(alerts).slice(-50);
    fs.writeFileSync(TMP_SENT_FILE, JSON.stringify(list), "utf-8");
  } catch {}
}

const handler = async () => {
  const { sendTelegram, admin, isSupabaseConfigured, isSyncEnabled } = await import("@/lib/erp.server");
  const { PERIODS, istNow, getTimetable } = await import("@/lib/timetable");

  const db = isSupabaseConfigured() ? admin() : null;
  const syncActive = await isSyncEnabled(db);
  if (!syncActive) {
    return Response.json({ ok: true, skipped: "sync disabled" });
  }

  const { day, minutes } = istNow();
  if (!day) return Response.json({ ok: true, skipped: "weekend" });

  const timetable = await getTimetable(db);
  const sentAlerts = getSentAlerts();

  for (const period of PERIODS) {
    if (period.isBreak) continue;
    const slot = timetable[day]?.[period.key];
    if (!slot) continue;

    const alert10mKey = `10m_${day}_${period.key}`;
    const alertNowKey = `now_${day}_${period.key}`;

    // 10-minute reminder window (fires once between 10 to 0 mins before class starts)
    if (minutes >= period.start - 10 && minutes < period.start) {
      if (sentAlerts.has(alert10mKey)) continue;
      const venueInfo = slot.venue ? ` (${slot.venue})` : "";
      await sendTelegram(
        `📚 Period ${period.label.replace("P", "")} starting in 10 mins: ${slot.coursecode} · ${slot.section} · Room ${slot.room}${venueInfo}`,
      );
      recordSentAlert(alert10mKey);
      return Response.json({ ok: true, notified: `${period.key}_10m` });
    }

    // At start window (fires once right when class starts)
    if (minutes >= period.start && minutes <= period.start + 5) {
      if (sentAlerts.has(alertNowKey)) continue;
      const venueInfo = slot.venue ? ` (${slot.venue})` : "";
      await sendTelegram(
        `📚 Period ${period.label.replace("P", "")} starting now: ${slot.coursecode} · ${slot.section} · Room ${slot.room}${venueInfo}`,
      );
      recordSentAlert(alertNowKey);
      return Response.json({ ok: true, notified: `${period.key}_now` });
    }
  }

  return Response.json({ ok: true, notified: null });
};

export const Route = createFileRoute("/api/public/notify-period")({
  server: { handlers: { GET: handler, POST: handler } },
});
