import { createFileRoute } from "@tanstack/react-router";

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

  for (const period of PERIODS) {
    if (period.isBreak) continue;
    const slot = timetable[day]?.[period.key];
    if (!slot) continue;

    // 10-minute reminder window
    if (minutes >= period.start - 10 && minutes < period.start) {
      const venueInfo = slot.venue ? ` (${slot.venue})` : "";
      await sendTelegram(
        `📚 Period ${period.label.replace("P", "")} starting in 10 mins: ${slot.coursecode} · ${slot.section} · Room ${slot.room}${venueInfo}`,
      );
      return Response.json({ ok: true, notified: `${period.key}_10m` });
    }

    // At start / in session window
    if (minutes >= period.start && minutes < period.end) {
      const venueInfo = slot.venue ? ` (${slot.venue})` : "";
      const isLate = minutes > period.start + 5;
      const text = isLate
        ? `📚 Period ${period.label.replace("P", "")} in session: ${slot.coursecode} · ${slot.section} · Room ${slot.room}${venueInfo}`
        : `📚 Period ${period.label.replace("P", "")} starting now: ${slot.coursecode} · ${slot.section} · Room ${slot.room}${venueInfo}`;
      await sendTelegram(text);
      return Response.json({ ok: true, notified: `${period.key}_now` });
    }
  }

  return Response.json({ ok: true, notified: null });
};

export const Route = createFileRoute("/api/public/notify-period")({
  server: { handlers: { GET: handler, POST: handler } },
});
