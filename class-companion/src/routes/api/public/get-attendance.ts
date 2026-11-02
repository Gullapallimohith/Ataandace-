import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/get-attendance")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const {
          admin,
          getCachedSnapshots,
          getCachedHistory,
          getSession,
          isSupabaseConfigured,
          SEMESTER_DATA,
          fetchAttendanceHtml,
          parseAttendanceTable,
        } = await import("@/lib/erp.server");

        const url = new URL(request.url);
        const semesterKey = url.searchParams.get("semesterKey") || "2026-2027_odd";
        const semConfig = SEMESTER_DATA[semesterKey] ?? SEMESTER_DATA["2026-2027_odd"];

        let snapshots: any[] = [];
        let history: any[] = [];

        // For default 2026-2027 Odd Sem, load live snapshots / cache / Supabase
        if (semesterKey === "2026-2027_odd") {
          if (isSupabaseConfigured()) {
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
        } else {
          // If a past semester was selected, attempt live ERP query if session active
          let liveFetched = false;
          try {
            const session = await getSession();
            if (session?.cookies && session.status === "active") {
              const att = await fetchAttendanceHtml(session.cookies, {
                academicYearId: semConfig?.academicYear,
                semesterId: semConfig?.semesterId,
              });
              if (att.ok) {
                const parsed = parseAttendanceTable(att.html);
                if (parsed.length > 0) {
                  snapshots = parsed;
                  liveFetched = true;
                }
              }
            }
          } catch {}

          if (!liveFetched && semConfig?.courses) {
            snapshots = semConfig.courses;
          }
        }

        let sessionStatus = "active";
        try {
          const session = await getSession();
          sessionStatus = session?.status ?? "active";
        } catch {}

        return Response.json({
          ok: true,
          semesterKey,
          semesterLabel: semConfig?.label ?? "Academic Year 2026 – 2027 (Odd Sem)",
          academicYear: semConfig?.academicYear ?? "2026 - 2027",
          semesterId: semConfig?.semesterId ?? "odd",
          snapshots,
          history,
          sessionStatus,
          count: snapshots.length,
        });
      },
    },
  },
});
