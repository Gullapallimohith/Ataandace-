import { createFileRoute } from "@tanstack/react-router";

const handler = async () => {
  const { startErpLogin } = await import("@/lib/erp.server");
  try {
    const result = await startErpLogin();
    return Response.json(result, { status: result.ok ? 200 : 502 });
  } catch (error) {
    console.error("start-login failed", error);
    return Response.json({ ok: false, message: String(error) }, { status: 500 });
  }
};

export const Route = createFileRoute("/api/public/start-login")({
  server: { handlers: { GET: handler, POST: handler } },
});
