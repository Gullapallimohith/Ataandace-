import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/sync-snapshot")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { saveCachedSnapshots, saveCachedHistory, saveSession, TELEGRAM_BOT_TOKEN } = await import("@/lib/erp.server");
        
        try {
          const auth = request.headers.get("authorization") || "";
          const expectedAuth = `Bearer ${TELEGRAM_BOT_TOKEN}`;
          if (auth && auth !== expectedAuth) {
            return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
          }

          const body = await request.json();
          if (Array.isArray(body.snapshots) && body.snapshots.length > 0) {
            saveCachedSnapshots(body.snapshots);
          }
          if (Array.isArray(body.history) && body.history.length > 0) {
            saveCachedHistory(body.history);
          }
          if (body.session && body.session.cookies) {
            await saveSession(null, body.session);
          }

          return Response.json({
            ok: true,
            snapshotsCount: body.snapshots?.length || 0,
            historyCount: body.history?.length || 0,
            hasSession: Boolean(body.session?.cookies),
            updated_at: new Date().toISOString(),
          });
        } catch (err: any) {
          return Response.json({ ok: false, error: err.message }, { status: 500 });
        }
      },
    },
  },
});

