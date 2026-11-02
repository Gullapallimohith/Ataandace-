import { createFileRoute } from "@tanstack/react-router";

type TelegramUpdate = {
  message?: { text?: string };
  edited_message?: { text?: string };
};

export const Route = createFileRoute("/api/public/telegram-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const {
          admin,
          getSession,
          saveSession,
          sendTelegram,
          startErpLogin,
          erpFetch,
          looksLikeLoginPage,
          ERP_LOGIN_URL,
        } = await import("@/lib/erp.server");

        let update: TelegramUpdate;
        try {
          update = (await request.json()) as TelegramUpdate;
        } catch {
          return Response.json({ ok: true, ignored: "invalid body" });
        }

        const raw = update.message?.text ?? update.edited_message?.text ?? "";
        const trimmed = raw.trim();
        if (!trimmed) return Response.json({ ok: true, ignored: "no text" });

        const db = admin();

        // Handle /bunk query command
        if (/^\/bunk/i.test(trimmed)) {
          const { calculateBunkDrop, formatBunkTelegramHtml } = await import("@/lib/bunk-calculator");
          const { getTimetable } = await import("@/lib/timetable");
          const currentTimetable = await getTimetable(db);
          const result = await calculateBunkDrop(trimmed, db, currentTimetable);
          await sendTelegram(formatBunkTelegramHtml(result));
          return Response.json({ ok: true, command: "bunk", result });
        }

        // Handle /attendance or /status command
        if (/^\/(attendance|status|help)/i.test(trimmed)) {
          const { getCachedSnapshots } = await import("@/lib/erp.server");
          let rows = getCachedSnapshots();
          if (process.env["SUPABASE_URL"] && !process.env["SUPABASE_URL"].includes("YOUR-PROJECT-REF")) {
            try {
              const { data } = await db.from("attendance_snapshot").select("*");
              if (data && data.length > 0) rows = data;
            } catch {}
          }
          const conducted = (rows ?? []).reduce((s, r) => s + (r.total_conducted || 0), 0);
          const attended = (rows ?? []).reduce((s, r) => s + (r.total_attended || 0), 0);
          const pctVal = conducted > 0 ? ((attended / conducted) * 100).toFixed(1) : "0.0";
          await sendTelegram(
            `📊 <b>Class Companion Status (2026 - 2027 Odd Sem)</b>\n` +
            `• Overall Attendance: <b>${pctVal}%</b> (${attended}/${conducted} classes)\n` +
            `• Tracked Courses: <b>${rows?.length ?? 0} components</b>\n\n` +
            `💡 <b>Commands available:</b>\n` +
            `• <code>/bunk dd-mm-yyyy day</code> — calculate attendance drop if you miss classes on that day\n` +
            `• <code>/attendance</code> — show current attendance summary\n` +
            `• <code>/sync</code> — trigger live ERP sync`
          );
          return Response.json({ ok: true, command: "status" });
        }

        // Handle /login command to send fresh captcha
        if (/^\/login/i.test(trimmed)) {
          await sendTelegram("🔄 Fetching fresh ERP login CAPTCHA for Academic Year 2026 - 2027 Odd Sem...");
          const res = await startErpLogin();
          return Response.json({ ok: true, command: "login", status: res.ok });
        }

        // Handle /sync command
        if (/^\/sync/i.test(trimmed)) {
          const session = await getSession(db);
          if (!session || !session.cookies || session.status !== "active") {
            await sendTelegram("⚠️ ERP session is not active. Starting fresh login...");
            await startErpLogin();
            return Response.json({ ok: false, error: "session not active" });
          }
          const { fetchAttendanceHtml, parseAttendanceTable, saveCachedSnapshots, syncTimetable } =
            await import("@/lib/erp.server");
          const att = await fetchAttendanceHtml(session.cookies);
          if (att.ok) {
            const rows = parseAttendanceTable(att.html);
            if (rows.length > 0) {
              saveCachedSnapshots(rows);
              const conducted = rows.reduce((s, r) => s + r.total_conducted, 0);
              const attended = rows.reduce((s, r) => s + r.total_attended, 0);
              const pctVal = conducted > 0 ? ((attended / conducted) * 100).toFixed(1) : "0.0";
              await sendTelegram(
                `✅ <b>Synced Attendance (2026 - 2027 Odd Sem)</b>\n` +
                `📊 Overall Attendance: <b>${pctVal}%</b> (${attended}/${conducted} classes)\n` +
                `📚 Tracked Courses: <b>${rows.length} components</b>`
              );
              return Response.json({ ok: true, synced: rows.length });
            }
          }
          await sendTelegram("⚠️ Could not fetch updated attendance. Session may have expired. Generating new login...");
          await startErpLogin();
          return Response.json({ ok: false, error: "fetch failed" });
        }

        // Parse credentials / CAPTCHA from user reply
        const tokens = trimmed.split(/\s+/);
        let erpUser = (process.env["ERP_USERNAME"] ?? "").trim();
        let erpPass = (process.env["ERP_PASSWORD"] ?? "").trim();
        let erpCaptcha = "";

        if (tokens.length >= 3) {
          erpUser = tokens[0]!;
          erpPass = tokens[1]!;
          erpCaptcha = tokens[tokens.length - 1]!.replace(/[^A-Za-z0-9]/g, "");
        } else {
          erpCaptcha = tokens[tokens.length - 1]!.replace(/[^A-Za-z0-9]/g, "");
        }

        if (!erpCaptcha) return Response.json({ ok: true, ignored: "no captcha in text" });

        const session = await getSession(db);
        if (!session || session.status !== "waiting_captcha" || !session.cookies) {
          await sendTelegram(
            "🔄 <b>Session Refreshed</b>\n" +
            "The previous CAPTCHA had expired or wasn't active. Generating a brand new CAPTCHA for you now..."
          );
          await startErpLogin();
          return Response.json({ ok: true, note: "started fresh login" });
        }

        const { submitErpLogin } = await import("@/lib/erp.server");
        const loginRes = await submitErpLogin(erpUser, erpPass, erpCaptcha);

        if (!loginRes.ok) {
          await sendTelegram(
            `❌ <b>Login Failed:</b> ${loginRes.message || "Invalid CAPTCHA or credentials"}\n` +
            `Sending a fresh CAPTCHA image now...`
          );
          await startErpLogin();
          return Response.json({ ok: false, error: loginRes.message });
        }

        return Response.json({ ok: true, login: "active", rowsParsed: loginRes.rowsParsed });

      },
    },
  },
});
