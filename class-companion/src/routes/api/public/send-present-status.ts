import { createFileRoute } from "@tanstack/react-router";

async function deliverPresentReport() {
  const {
    admin,
    sendTelegram,
    getCachedSnapshots,
    getCachedHistory,
    isSupabaseConfigured,
  } = await import("@/lib/erp.server");

  let snapshots = getCachedSnapshots();
  let history = getCachedHistory();

  if (isSupabaseConfigured()) {
    try {
      const db = admin();
      const { data: snapData } = await db.from("attendance_snapshot").select("*").order("coursecode");
      if (snapData && snapData.length > 0) snapshots = snapData;

      const { data: histData } = await db
        .from("attendance_history")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (histData && histData.length > 0) history = histData;
    } catch {}
  }

  const conducted = (snapshots ?? []).reduce((s, r) => s + (r.total_conducted || 0), 0);
  const attended = (snapshots ?? []).reduce((s, r) => s + (r.total_attended || 0), 0);
  const absent = Math.max(conducted - attended, 0);

  const WEIGHTS: Record<string, number> = { L: 1, P: 0.5, T: 0.25, S: 0.25 };
  const byCourse = new Map<string, any[]>();
  for (const row of (snapshots ?? [])) {
    const list = byCourse.get(row.coursecode) ?? [];
    list.push(row);
    byCourse.set(row.coursecode, list);
  }
  const courseWeightedList: number[] = [];
  for (const [_, list] of byCourse) {
    const comps = list.filter((r) => WEIGHTS[(r.ltps || "").trim().toUpperCase().slice(0, 1)] && r.total_conducted);
    const wSum = comps.reduce((s, r) => s + (WEIGHTS[(r.ltps || "").trim().toUpperCase().slice(0, 1)] || 0), 0);
    const weighted = wSum
      ? comps.reduce((s, r) => s + ((r.total_attended / r.total_conducted) * 100) * (WEIGHTS[(r.ltps || "").trim().toUpperCase().slice(0, 1)] || 0), 0) / wSum
      : 0;
    courseWeightedList.push(weighted);
  }
  const pctVal = courseWeightedList.length > 0
    ? (courseWeightedList.reduce((s, v) => s + v, 0) / courseWeightedList.length).toFixed(1)
    : (conducted > 0 ? ((attended / conducted) * 100).toFixed(1) : "0.0");

  // Filter present records
  const presentEntries = (history ?? []).filter((h) => h.status === "present");

  // Send individual Present alerts for each class
  if (presentEntries.length > 0) {
    for (const p of presentEntries.slice(0, 5)) {
      const matchCourse = (snapshots ?? []).find(
        (s) => s.coursecode === p.coursecode && (!p.section || s.section === p.section),
      );
      const cAttended = matchCourse ? matchCourse.total_attended : p.total_attended ?? 0;
      const cConducted = matchCourse ? matchCourse.total_conducted : p.total_conducted ?? 0;
      const cPct = cConducted > 0 ? ((cAttended / cConducted) * 100).toFixed(1) : "";

      const msg =
        `✅ <b>MARKED PRESENT</b>\n` +
        `📚 <b>${p.coursedesc || p.coursecode}</b>\n` +
        `📌 Code: <code>${p.coursecode}</code> · Section: ${p.section || "S-1"}\n` +
        (cPct ? `📊 Course Attendance: <b>${cAttended}/${cConducted} (${cPct}%)</b>\n` : "") +
        `⏰ Details: ${p.note || "Recorded"}\n` +
        `🗓️ Date: ${p.date}`;

      await sendTelegram(msg);
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  // Summary message
  const summaryMsg =
    `📈 <b>OVERALL ATTENDANCE SUMMARY</b>\n` +
    `🎯 <b>Academic Year 2026 – 2027 (Odd Sem)</b>\n` +
    `👤 <b>Student: Mohith (2420030663)</b>\n\n` +
    `• Overall Attendance: <b>${pctVal}%</b>\n` +
    `• Attended: <b>${attended}</b> / Conducted: <b>${conducted}</b> (Absent: <b>${absent}</b>)\n` +
    `• Status: ${Number(pctVal) >= 75 ? "✅ Safe (Above 75% Criteria)" : "⚠️ Needs Attention"}\n\n` +
    `💡 <i>Auto-synced from Class Companion • KL ERP</i>`;

  const res = await sendTelegram(summaryMsg);

  return Response.json({
    ok: true,
    sentCount: Math.min(presentEntries.length, 5),
    overall: pctVal,
    attended,
    conducted,
    messageId: res.messageId,
  });
}

export const Route = createFileRoute("/api/public/send-present-status")({
  server: {
    handlers: {
      GET: async () => deliverPresentReport(),
      POST: async () => deliverPresentReport(),
    },
  },
});
