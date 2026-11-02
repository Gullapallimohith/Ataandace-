import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/test-telegram")({
  server: {
    handlers: {
      GET: async () => {
        const { sendTelegram } = await import("@/lib/erp.server");
        const timestamp = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
        const text = `🔔 <b>Class Companion System Test</b>\nWebsite backend test message sent at <code>${timestamp}</code>.\nAll systems operational.`;
        const result = await sendTelegram(text);
        return Response.json(
          {
            ok: result.ok,
            messageId: result.messageId,
            error: result.error,
            sentAt: timestamp,
          },
          { status: result.ok ? 200 : 500 },
        );
      },
      POST: async ({ request }) => {
        const { sendTelegram } = await import("@/lib/erp.server");
        let customText = "";
        try {
          const body = (await request.json()) as { text?: string };
          customText = body?.text || "";
        } catch {}
        const text =
          customText ||
          `🔔 <b>Class Companion System Test</b>\nTriggered via API at ${new Date().toISOString()}`;
        const result = await sendTelegram(text);
        return Response.json(
          {
            ok: result.ok,
            messageId: result.messageId,
            error: result.error,
          },
          { status: result.ok ? 200 : 500 },
        );
      },
    },
  },
});

