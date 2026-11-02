import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/login-erp")({
  server: {
    handlers: {
      GET: async () => {
        const { startErpLogin } = await import("@/lib/erp.server");
        try {
          const result = await startErpLogin();
          return Response.json(result, { status: result.ok ? 200 : 502 });
        } catch (error) {
          console.error("login-erp GET failed:", error);
          return Response.json({ ok: false, message: String(error) }, { status: 500 });
        }
      },
      POST: async ({ request }) => {
        const { submitErpLogin } = await import("@/lib/erp.server");
        try {
          const body = (await request.json()) as {
            username?: string;
            password?: string;
            captcha?: string;
          };
          const result = await submitErpLogin(body.username, body.password, body.captcha);
          return Response.json(result, { status: result.ok ? 200 : 400 });
        } catch (error) {
          console.error("login-erp POST failed:", error);
          return Response.json({ ok: false, message: String(error) }, { status: 500 });
        }
      },
    },
  },
});
