import { createFileRoute } from "@tanstack/react-router";

async function deliverWeeklyReport() {
  const { sendWeeklyAttendanceReport } = await import("@/lib/erp.server");
  try {
    const result = await sendWeeklyAttendanceReport();
    return Response.json({
      ok: result.ok,
      messageId: result.messageId,
      error: result.error,
      report: result.text,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return Response.json({ ok: false, error: err?.message || String(err) }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/weekly-report")({
  server: {
    handlers: {
      GET: async () => deliverWeeklyReport(),
      POST: async () => deliverWeeklyReport(),
    },
  },
});

