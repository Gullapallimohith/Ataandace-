// Telegram Poller & Background Scheduler for Local/Daemon Execution
// 1. Polls getUpdates from Telegram and forwards to local webhook
// 2. Automatically triggers attendance check every 10 minutes
// 3. Automatically triggers class period alerts every 5 minutes
import fs from "node:fs";
import path from "node:path";

// Load environment variables from .env file securely
function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}
loadEnv();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8613481579:AAGKXxdS4Y9jkJhFpdOQVDXVefCvI2-shtI";
const PROD_URL = "https://ataandace.vercel.app";
const BASE_APP_URL = process.env.APP_URL || "http://localhost:8080";

const WEBHOOK_URL = process.env.WEBHOOK_URL || `${BASE_APP_URL}/api/public/telegram-webhook`;
const ATTENDANCE_POLL_URL = process.env.ATTENDANCE_POLL_URL || `${BASE_APP_URL}/api/public/poll-attendance`;
const NOTIFY_PERIOD_URL = process.env.NOTIFY_PERIOD_URL || `${BASE_APP_URL}/api/public/notify-period`;
const WEEKLY_REPORT_URL = process.env.WEEKLY_REPORT_URL || `${BASE_APP_URL}/api/public/weekly-report`;

if (!BOT_TOKEN) {
  console.error("[Telegram] ERROR: TELEGRAM_BOT_TOKEN is not configured in environment or .env file!");
  process.exit(1);
}

let lastUpdateId = 0;

async function pollTelegramUpdates() {
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=10`;
    const res = await fetch(url);
    if (!res.ok) {
      await new Promise((r) => setTimeout(r, 2000));
      return pollTelegramUpdates();
    }
    const data = await res.json();
    if (data.ok && Array.isArray(data.result)) {
      for (const update of data.result) {
        lastUpdateId = Math.max(lastUpdateId, update.update_id);
        const text = update.message?.text || update.edited_message?.text;
        console.log(`[Telegram] Processing update ${update.update_id}:`, text);
        try {
          const postRes = await fetch(WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(update),
          });
          if (!postRes.ok) {
            console.warn(`[Telegram] Webhook returned status ${postRes.status}`);
          }
        } catch (postErr) {
          console.error("[Telegram] Forwarding error:", postErr.message);
        }
      }
    }
  } catch (err) {
    console.error("[Telegram] Poll error:", err.message);
    await new Promise((r) => setTimeout(r, 3000));
  }
  setImmediate(pollTelegramUpdates);
}

/* ---------------- 10-Minute Attendance Scheduler ---------------- */
const TEN_MINUTES_MS = 10 * 60 * 1000;
const FIVE_MINUTES_MS = 5 * 60 * 1000;

async function runAttendancePoll() {
  const timestamp = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  try {
    console.log(`[Scheduler] [${timestamp}] Running 10-minute automated attendance poll...`);
    const res = await fetch(ATTENDANCE_POLL_URL, { method: "GET" });
    if (res.ok) {
      const data = await res.json();
      console.log(`[Scheduler] [${timestamp}] Attendance poll completed:`, JSON.stringify(data));
    } else {
      console.warn(`[Scheduler] [${timestamp}] Attendance poll returned HTTP ${res.status}`);
    }
  } catch (err) {
    console.error(`[Scheduler] [${timestamp}] Attendance poll network error:`, err.message);
  }
}

async function runPeriodAlert() {
  try {
    const res = await fetch(NOTIFY_PERIOD_URL, { method: "GET" });
    if (res.ok) {
      const data = await res.json();
      if (data.notified) {
        console.log(`[Scheduler] Period alert triggered:`, data.notified);
      }
    }
  } catch (err) {
    // Ignore routine network blips
  }
}

/* ---------------- Sunday Morning (9:00 AM IST) Weekly Report Scheduler ---------------- */
let lastWeeklyReportDate = null;

async function runWeeklyReport() {
  const timestamp = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  try {
    console.log(`[Scheduler] [${timestamp}] Triggering Sunday Morning Weekly Attendance Report...`);
    let res = null;
    try {
      res = await fetch(WEEKLY_REPORT_URL, { method: "POST" });
    } catch {
      // Fallback to production cloud URL if local endpoint not running
      res = await fetch(`${PROD_URL}/api/public/weekly-report`, { method: "POST" });
    }
    if (res && res.ok) {
      const data = await res.json();
      console.log(`[Scheduler] [${timestamp}] Weekly report delivered:`, data.messageId || "sent");
    } else {
      console.warn(`[Scheduler] [${timestamp}] Weekly report returned HTTP ${res?.status}`);
    }
  } catch (err) {
    console.error(`[Scheduler] [${timestamp}] Weekly report error:`, err.message);
  }
}

function checkSundayWeeklySchedule() {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const isSunday = ist.getUTCDay() === 0;
  const hours = ist.getUTCHours();
  const dateStr = ist.toISOString().slice(0, 10);

  // Trigger automatically Sunday morning starting at 9:00 AM IST (runs once per Sunday)
  if (isSunday && hours >= 9 && lastWeeklyReportDate !== dateStr) {
    lastWeeklyReportDate = dateStr;
    runWeeklyReport();
  }
}

console.log(`[Telegram] Worker started successfully.`);
console.log(`[Telegram] Bot Token: ${BOT_TOKEN.slice(0, 6)}... configured.`);
console.log(`[Scheduler] 10-Minute Attendance Monitor scheduled (interval: 600,000 ms).`);
console.log(`[Scheduler] 5-Minute Class Period Alerts scheduled (interval: 300,000 ms).`);
console.log(`[Scheduler] Sunday Morning (9:00 AM IST) Weekly Attendance Report scheduled.`);

// Start Telegram polling loop
pollTelegramUpdates();

// Start scheduled background jobs
setInterval(runAttendancePoll, TEN_MINUTES_MS);
setInterval(runPeriodAlert, FIVE_MINUTES_MS);
setInterval(checkSundayWeeklySchedule, 30 * 1000); // Check every 30 seconds for Sunday Morning

// Run initial check after 5s
setTimeout(runAttendancePoll, 5000);
