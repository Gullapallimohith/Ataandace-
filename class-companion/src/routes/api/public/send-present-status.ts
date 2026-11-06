import { createFileRoute } from "@tanstack/react-router";

// Present notifications are sent ONLY automatically when newly marked on KL ERP.
// Overall reports are sent ONLY when explicitly asked via /report or on Sundays.
async function handler() {
  return Response.json({
    ok: true,
    message: "Present alerts are sent automatically only when newly marked on ERP.",
  });
}

export const Route = createFileRoute("/api/public/send-present-status")({
  server: {
    handlers: {
      GET: handler,
      POST: handler,
    },
  },
});
