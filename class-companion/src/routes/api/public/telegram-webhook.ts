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
          ERP_USERNAME,
          ERP_PASSWORD,
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

        // Handle /next, /class, /room, /where, /timetable command
        if (/^(\/)?(next|class|room|where|timetable)/i.test(trimmed)) {
          const { PERIODS, istNow, getTimetable } = await import("@/lib/timetable");
          const { day, minutes } = istNow();
          if (!day) {
            await sendTelegram("🏖️ It's Sunday! No classes scheduled today.");
            return Response.json({ ok: true, command: "next", day: null });
          }

          const timetable = await getTimetable(db);
          const daySchedule = timetable[day] || {};

          let currentSlot: any = null;
          let nextSlot: any = null;
          let minsUntilNext = 0;

          for (const period of PERIODS) {
            if (period.isBreak) continue;
            const slot = daySchedule[period.key];
            if (!slot) continue;

            if (minutes >= period.start && minutes < period.end) {
              currentSlot = { period, slot };
            } else if (minutes < period.start && !nextSlot) {
              nextSlot = { period, slot };
              minsUntilNext = period.start - minutes;
            }
          }

          if (nextSlot) {
            const venueInfo = nextSlot.slot.venue ? ` (${nextSlot.slot.venue})` : "";
            const timeDesc = minsUntilNext <= 10
              ? `starting in ${minsUntilNext} mins`
              : `at ${Math.floor(nextSlot.period.start / 60)}:${String(nextSlot.period.start % 60).padStart(2, "0")}`;
            await sendTelegram(
              `📚 <b>Next Class Today (${day}):</b>\n` +
              `Period ${nextSlot.period.label.replace("P", "")} ${timeDesc}: ${nextSlot.slot.coursecode} · ${nextSlot.slot.section} · Room ${nextSlot.slot.room}${venueInfo}`
            );
          } else if (currentSlot) {
            const venueInfo = currentSlot.slot.venue ? ` (${currentSlot.slot.venue})` : "";
            await sendTelegram(
              `📚 <b>Current Class:</b> Period ${currentSlot.period.label.replace("P", "")}: ${currentSlot.slot.coursecode} · ${currentSlot.slot.section} · Room ${currentSlot.slot.room}${venueInfo}\n\n` +
              `🎉 No more classes scheduled after this today!`
            );
          } else {
            await sendTelegram(`🎉 All classes for today (${day}) are finished!`);
          }
          return Response.json({ ok: true, command: "next" });
        }

        // Handle /weekly or /report command
        if (/^(\/)?(weekly|report|averages)/i.test(trimmed)) {
          const { sendWeeklyAttendanceReport } = await import("@/lib/erp.server");
          const repResult = await sendWeeklyAttendanceReport();
          return Response.json({ ok: repResult.ok, command: "weekly", messageId: repResult.messageId });
        }

        // Handle /attendance, /status, /present, /today, or /help command (with or without leading slash)
        if (/^(\/)?(attendance|status|present|today|check|help)/i.test(trimmed)) {
          const { getCachedSnapshots, getCachedHistory, isSupabaseConfigured, formatPresentNotification } = await import("@/lib/erp.server");
          let rows = getCachedSnapshots();
          let hist = getCachedHistory();
          if (isSupabaseConfigured()) {
            try {
              const { data } = await db.from("attendance_snapshot").select("*");
              if (data && data.length > 0) rows = data;
              const { data: histData } = await db.from("attendance_history").select("*").limit(10);
              if (histData && histData.length > 0) hist = histData;
            } catch {}
          }
          const conducted = (rows ?? []).reduce((s, r) => s + (r.total_conducted || 0), 0);
          const attended = (rows ?? []).reduce((s, r) => s + (r.total_attended || 0), 0);
          const absent = Math.max(conducted - attended, 0);
          const pctVal = conducted > 0 ? ((attended / conducted) * 100).toFixed(1) : "0.0";

          const recentPresent = (hist ?? []).filter((h) => h.status === "present").slice(0, 5);

          // If specifically asked for "present", send each present class card matching the exact required format
          if (/present/i.test(trimmed) && recentPresent.length > 0) {
            for (const item of recentPresent) {
              const matchedRow = (rows ?? []).find(
                (r) => r.coursecode === item.coursecode && (!item.section || r.section === item.section),
              );
              const notif = formatPresentNotification({
                coursecode: item.coursecode,
                section: item.section || matchedRow?.section || item.coursecode,
                total_attended: matchedRow?.total_attended ?? 46,
                total_conducted: matchedRow?.total_conducted ?? 53,
              });
              await sendTelegram(notif);
              await new Promise((r) => setTimeout(r, 250));
            }
          }

          let presentTxt = recentPresent.length > 0
            ? recentPresent.map((h) => `• <b>${h.coursedesc || h.coursecode}</b>: 🟢 <b>PRESENT</b>`).join("\n")
            : "• All tracked courses in sync.";

          await sendTelegram(
            `📊 <b>Class Companion Status (2026 - 2027 Odd Sem)</b>\n` +
            `• Overall Attendance: <b>${pctVal}%</b> (${attended}/${conducted} classes)\n` +
            `• Total Absent Hours: <b>${absent}</b>\n` +
            `• Status: ${Number(pctVal) >= 75 ? "✅ Safe (Above 75%)" : "⚠️ Needs Attention"}\n\n` +
            `🟢 <b>Recent Present Marks:</b>\n` +
            `${presentTxt}\n\n` +
            `💡 <b>Commands available:</b>\n` +
            `• <code>/next</code> — check your next class, room & timing\n` +
            `• <code>/present</code> — view present status and attendance notifications\n` +
            `• <code>/weekly</code> — generate Sunday weekly subject averages report\n` +
            `• <code>/login</code> — request fresh ERP login CAPTCHA\n` +
            `• <code>/bunk dd-mm-yyyy day</code> — calculate bunk drop\n` +
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
        let erpUser = (process.env["ERP_USERNAME"] || ERP_USERNAME).trim();
        let erpPass = (process.env["ERP_PASSWORD"] || ERP_PASSWORD).trim();
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
