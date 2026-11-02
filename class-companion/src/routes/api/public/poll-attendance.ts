import { createFileRoute } from "@tanstack/react-router";

const handler = async () => {
  const {
    admin,
    getSession,
    saveSession,
    sendTelegram,
    startErpLogin,
    fetchAttendanceHtml,
    parseAttendanceTable,
    getCachedSnapshots,
    saveCachedSnapshots,
    getCachedHistory,
    saveCachedHistory,
    isSupabaseConfigured,
    isSyncEnabled,
    formatPresentNotification,
    checkAndNotifyAttendanceChanges,
  } = await import("@/lib/erp.server");
  const { istNow } = await import("@/lib/timetable");

  const db = isSupabaseConfigured() ? admin() : null;

  const syncActive = await isSyncEnabled(db);
  if (!syncActive) {
    return Response.json({ ok: true, skipped: "sync disabled" });
  }

  const session = await getSession(db);
  if (!session || session.status !== "active" || !session.cookies) {
    return Response.json({ ok: true, skipped: "session not active" });
  }

  const { html, cookies, ok } = await fetchAttendanceHtml(session.cookies);

  if (!ok) {
    await saveSession(db, { status: "expired" });
    await startErpLogin();
    return Response.json({ ok: true, session: "expired" });
  }

  if (cookies && cookies !== session.cookies) await saveSession(db, { cookies });

  // Sync timetable from ERP in background so timetable updates automatically if changed
  if (db) {
    try {
      const { syncTimetable } = await import("@/lib/erp.server");
      await syncTimetable(db, cookies || session.cookies);
    } catch (err) {
      console.warn("Timetable background sync skipped/failed:", err);
    }
  }

  const rows = parseAttendanceTable(html);
  if (rows.length === 0) {
    return Response.json({ ok: true, parsed: 0, note: "no attendance rows found" });
  }

  const { changes } = await checkAndNotifyAttendanceChanges(rows, db);

  return Response.json({
    ok: true,
    parsed: rows.length,
    changes,
    timestamp: new Date().toISOString(),
  });
};

export const Route = createFileRoute("/api/public/poll-attendance")({
  server: { handlers: { GET: handler, POST: handler } },
});
