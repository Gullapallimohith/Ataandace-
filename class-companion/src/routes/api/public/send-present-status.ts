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
  const pctVal = conducted > 0 ? ((attended / conducted) * 100).toFixed(1) : "0.0";

  // Recent present marks
  const recentPresent = (history ?? []).filter((h) => h.status === "present").slice(0, 5);
  let presentList = "";
  if (recentPresent.length > 0) {
    presentList = recentPresent
      .map(
        (h) =>
          `• <b>${h.coursedesc || h.coursecode}</b>: 🟢 <b>PRESENT</b> (${h.note || "Recorded"})`,
      )
      .join("\n");
  } else {
    presentList = "• All enrolled course components tracked.";
  }

  // Course summaries
  const topCourses = snapshots
    .slice(0, 6)
    .map((c) => {
      const cPct =
        c.total_conducted > 0
          ? ((c.total_attended / c.total_conducted) * 100).toFixed(1)
          : "0.0";
      return `• <b>${c.coursedesc || c.coursecode}</b> (${c.ltps || "L"}): ${c.total_attended}/${c.total_conducted} (<b>${cPct}%</b>)`;
    })
    .join("\n");

  const message =
    `📊 <b>KL University Attendance & Status Report</b>\n` +
    `🎯 <b>Target: Academic Year 2026 – 2027 (Odd Sem)</b>\n\n` +
    `📈 <b>Overall: ${pctVal}%</b> (${attended} Attended / ${conducted} Conducted)\n` +
    `❌ Total Absent Hours: <b>${absent}</b>\n` +
    `⚡ Status: ${Number(pctVal) >= 75 ? "✅ Safe (Above 75% threshold)" : "⚠️ Caution (< 75% threshold)"}\n\n` +
    `🟢 <b>Recent Present Marks:</b>\n` +
    `${presentList}\n\n` +
    `📚 <b>Key Courses:</b>\n` +
    `${topCourses}\n\n` +
    `<i>Auto-synced from Class Companion • KL ERP</i>`;

  const res = await sendTelegram(message);
  return Response.json({
    ok: res.ok,
    error: res.error,
    messageId: res.messageId,
    overall: pctVal,
    attended,
    conducted,
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

