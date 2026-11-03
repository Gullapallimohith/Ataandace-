import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/telegram-relay")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { sendTelegram, sendTelegramPhoto, telegramApi } = await import("@/lib/erp.server");
        try {
          const body = (await request.json()) as any;

          // 1. Send text message
          if (body.type === "message" || (body.text && !body.type)) {
            const res = await sendTelegram(body.text);
            return Response.json(res);
          }

          // 2. Send photo (base64)
          if (body.type === "photo" && body.photoBase64) {
            const buffer = Buffer.from(body.photoBase64, "base64");
            const res = await sendTelegramPhoto(buffer, body.caption || "");
            return Response.json(res);
          }

          // 3. Get updates (inbound messages)
          if (body.type === "getUpdates") {
            const offset = body.offset || 0;
            const res = await fetch(telegramApi(`getUpdates?offset=${offset}&timeout=5`));
            if (!res.ok) {
              return Response.json({ ok: false, error: await res.text() }, { status: res.status });
            }
            const data = await res.json();
            return Response.json(data);
          }

          // 4. Delete webhook
          if (body.type === "deleteWebhook") {
            const res = await fetch(telegramApi("deleteWebhook?drop_pending_updates=false"));
            const data = await res.json();
            return Response.json(data);
          }

          return Response.json({ ok: false, error: "unknown action" }, { status: 400 });
        } catch (err: any) {
          return Response.json({ ok: false, error: err.message }, { status: 500 });
        }
      },
    },
  },
});

