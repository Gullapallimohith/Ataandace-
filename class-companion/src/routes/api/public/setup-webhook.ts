import { createFileRoute } from "@tanstack/react-router";
import { telegramApi as tgUrl } from "@/lib/erp.server";

const BASE = process.env["APP_URL"] || "https://YOUR-PUBLIC-URL.com";

async function register() {
  if (!process.env["TELEGRAM_BOT_TOKEN"]) {
    return Response.json({ error: "TELEGRAM_BOT_TOKEN not configured" }, { status: 500 });
  }

  const res = await fetch(tgUrl("setWebhook"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: `${BASE}/api/public/telegram-webhook`,
      allowed_updates: ["message", "edited_message"],
      drop_pending_updates: true,
    }),
  });
  const setResult = await res.json();

  const infoRes = await fetch(tgUrl("getWebhookInfo"));
  const info = await infoRes.json();

  return Response.json({ setResult, info });
}

export const Route = createFileRoute("/api/public/setup-webhook")({
  server: {
    handlers: {
      GET: register,
      POST: register,
    },
  },
});
