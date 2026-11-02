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

  let previousSnapshots: any[] = [];
  if (db) {
    try {
      const { data } = await db
        .from("attendance_snapshot")
        .select("coursecode, section, ltps, total_conducted, total_attended");
      if (data && data.length > 0) previousSnapshots = data;
    } catch {}
  }
  if (previousSnapshots.length === 0) {
    previousSnapshots = getCachedSnapshots();
  }

  const previous = new Map(
    (previousSnapshots ?? []).map((s) => [`${s.coursecode}|${s.section}|${s.ltps}`, s] as const),
  );

  const today = istNow().dateString;
  const changes: string[] = [];
  const newHistoryEntries: any[] = [];

  for (const row of rows) {
    const prev = previous.get(`${row.coursecode}|${row.section}|${row.ltps}`);
    if (prev && row.total_conducted > prev.total_conducted) {
      const status = row.total_attended > prev.total_attended ? "present" : "absent";
      const entry = {
        id: `h_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        coursecode: row.coursecode,
        coursedesc: row.coursedesc,
        section: row.section,
        status,
        date: today,
        note: `Conducted: ${row.total_conducted}, Attended: ${row.total_attended}`,
        created_at: new Date().toISOString(),
      };
      newHistoryEntries.push(entry);

      if (db) {
        try {
          await db.from("attendance_history").insert({
            coursecode: row.coursecode,
            coursedesc: row.coursedesc,
            section: row.section,
            status,
            date: today,
          });
        } catch {}
      }

      changes.push(`${row.coursecode} · ${row.section} (${status.toUpperCase()})`);
      await sendTelegram(
        `${status === "present" ? "✅" : "❌"} <b>${row.coursecode}</b> · ${row.section}\nMarked <b>${status.toUpperCase()}</b>\nAttendance: ${row.total_attended}/${row.total_conducted}`,
      );
    }
  }

  if (newHistoryEntries.length > 0) {
    saveCachedHistory([...newHistoryEntries, ...getCachedHistory()]);
  }

  saveCachedSnapshots(rows);

  if (db) {
    try {
      await db.from("attendance_snapshot").upsert(
        rows.map((r) => ({ ...r, updated_at: new Date().toISOString() })),
        { onConflict: "coursecode,section,ltps" },
      );
    } catch (upsertError: any) {
      console.warn("DB snapshot upsert warning:", upsertError?.message);
    }
  }

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
