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
    if (Math.abs(minutes - period.start) > 2) continue;
    const slot = timetable[day]?.[period.key];
    if (!slot) continue;
    await sendTelegram(
      `📚 Period ${period.label.replace("P", "")} starting now: ${slot.coursecode} · ${slot.section} · Room ${slot.room}`,
    );
    return Response.json({ ok: true, notified: period.key });
  }

  return Response.json({ ok: true, notified: null });
};

export const Route = createFileRoute("/api/public/notify-period")({
  server: { handlers: { GET: handler, POST: handler } },
});
