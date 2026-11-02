import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/get-attendance")({
  server: {
    handlers: {
      GET: async () => {
        const { admin, getCachedSnapshots, getCachedHistory, getSession } = await import(
          "@/lib/erp.server"
        );
        let snapshots: any[] = [];
        let history: any[] = [];

        if (process.env["SUPABASE_URL"] && !process.env["SUPABASE_URL"].includes("YOUR-PROJECT-REF")) {
          try {
            const db = admin();
            const { data } = await db.from("attendance_snapshot").select("*").order("coursecode");
            if (data && data.length > 0) snapshots = data;

            const { data: histData } = await db
              .from("attendance_history")
              .select("*")
              .order("created_at", { ascending: false })
              .limit(100);
            if (histData && histData.length > 0) history = histData;
          } catch {}
        }

        if (snapshots.length === 0) {
          snapshots = getCachedSnapshots();
        }
        if (history.length === 0) {
          history = getCachedHistory();
        }

        let sessionStatus = "active";
        try {
          const session = await getSession();
          sessionStatus = session?.status ?? "active";
        } catch {}

        return Response.json({
          ok: true,
          snapshots,
          history,
          sessionStatus,
          count: snapshots.length,
        });
      },
    },
  },
});
