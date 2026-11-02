import { createFileRoute } from "@tanstack/react-router";

const handler = async ({ request }: { request: Request }) => {
  const { admin } = await import("@/lib/erp.server");
  const { calculateBunkDrop } = await import("@/lib/bunk-calculator");
  const { getTimetable } = await import("@/lib/timetable");

  let query = "";
  if (request.method === "POST") {
    try {
      const body = (await request.json()) as { query?: string; date?: string; day?: string };
      if (body.query) {
        query = body.query;
      } else if (body.date || body.day) {
        query = `/bunk ${body.date ?? ""} ${body.day ?? ""}`.trim();
      }
    } catch {
      // fallback to url search params
    }
  }

  if (!query) {
    const url = new URL(request.url);
    const q = url.searchParams.get("query");
    const date = url.searchParams.get("date");
    const day = url.searchParams.get("day");
    if (q) {
      query = q;
    } else if (date || day) {
      query = `/bunk ${date ?? ""} ${day ?? ""}`.trim();
    } else {
      query = "/bunk today";
    }
  }

  try {
    const db = admin();
    const currentTimetable = await getTimetable(db);
    const result = await calculateBunkDrop(query, db, currentTimetable);
    return Response.json({ ok: true, data: result });
  } catch (error) {
    console.error("bunk-calculator error:", error);
    return Response.json({ ok: false, error: String(error) }, { status: 500 });
  }
};

export const Route = createFileRoute("/api/public/bunk-calculator")({
  server: {
    handlers: {
      GET: handler,
      POST: handler,
    },
  },
});
