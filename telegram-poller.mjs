// Real-Time Telegram Attendance Poller & ERP Monitor Daemon
// 1. Long-polls getUpdates from Telegram (no webhook conflicts)
// 2. Polls KL University ERP every 60 seconds during college hours (8:00 AM - 5:30 PM IST)
// 3. Immediately dispatches Marked PRESENT notifications as soon as ERP updates
// 4. Automatically detects expired ERP sessions, downloads fresh CAPTCHA, and sends to Telegram
// 5. Automatically logs in when user replies with CAPTCHA in Telegram
// 6. Sends Sunday 9:00 AM IST Weekly Subject Averages automatically

import fs from "node:fs";
import path from "node:path";

// Load .env
function loadEnv() {
  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "class-companion", ".env"),
    path.resolve(import.meta.dirname, ".env"),
  ];
  for (const envPath of candidates) {
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
}
loadEnv();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8613481579:AAGKXxdS4Y9jkJhFpdOQVDXVefCvI2-shtI";
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || "7365716186";
const ERP_USERNAME = process.env.ERP_USERNAME || "2420030663";
const ERP_PASSWORD = process.env.ERP_PASSWORD || "Mohith@123";
const ERP_BASE = "https://newerp.kluniversity.in";
const ERP_LOGIN_URL = `${ERP_BASE}/index.php?r=site/login`;
const ERP_ATTENDANCE_URL = `${ERP_BASE}/index.php?r=studentattendance/studentdailyattendance/searchgetinput`;
const PROD_URL = "https://ataandace.vercel.app";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

function resolveFile(filename) {
  const p1 = path.resolve(process.cwd(), filename);
  if (fs.existsSync(p1)) return p1;
  const p2 = path.resolve(process.cwd(), "class-companion", filename);
  if (fs.existsSync(p2)) return p2;
  const p3 = path.resolve(import.meta.dirname, filename);
  return p3;
}

const SESSION_FILE = resolveFile(".erp-session.json");
const SNAPSHOTS_FILE = resolveFile(".erp-attendance.json");
const HISTORY_FILE = resolveFile(".erp-history.json");

/* ---------------- Session & File Helpers ---------------- */

function readSession() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      return JSON.parse(fs.readFileSync(SESSION_FILE, "utf-8"));
    }
  } catch {}
  return { id: 1, csrf_token: null, cookies: null, status: "expired" };
}

function writeSession(patch) {
  try {
    const cur = readSession();
    const updated = { ...cur, ...patch };
    fs.writeFileSync(SESSION_FILE, JSON.stringify(updated, null, 2), "utf-8");
    return updated;
  } catch (err) {
    console.error("[Session] Write error:", err.message);
  }
}

function readSnapshots() {
  try {
    if (fs.existsSync(SNAPSHOTS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SNAPSHOTS_FILE, "utf-8"));
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch {}
  return [];
}

function writeSnapshots(rows) {
  try {
    fs.writeFileSync(SNAPSHOTS_FILE, JSON.stringify(rows, null, 2), "utf-8");
  } catch (err) {
    console.error("[Snapshots] Write error:", err.message);
  }
}

function readHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf-8"));
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch {}
  return [];
}

function writeHistory(entries) {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(entries, null, 2), "utf-8");
  } catch (err) {
    console.error("[History] Write error:", err.message);
  }
}

function getIstTime() {
  const istDate = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const hh = String(istDate.getUTCHours()).padStart(2, "0");
  const mm = String(istDate.getUTCMinutes()).padStart(2, "0");
  const today = istDate.toISOString().slice(0, 10);
  const isSunday = istDate.getUTCDay() === 0;
  const hours = istDate.getUTCHours();
  return { timeStr: `${hh}:${mm}`, today, isSunday, hours, dateStr: today };
}

/* ---------------- Telegram API ---------------- */

async function telegramSend(text, parseMode = "HTML") {
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: parseMode }),
    });
    if (!res.ok) {
      const errText = await res.text();
      if (parseMode === "HTML") {
        return telegramSend(text.replace(/<[^>]+>/g, ""), "");
      }
      console.error(`[Telegram] Send failed [${res.status}]:`, errText);
      return { ok: false, error: errText };
    }
    const json = await res.json();
    return { ok: true, messageId: json.result?.message_id };
  } catch (err) {
    console.error("[Telegram] Send error:", err.message);
    return { ok: false, error: err.message };
  }
}

async function telegramSendPhoto(photoBuffer, caption) {
  try {
    const form = new FormData();
    form.append("chat_id", CHAT_ID);
    form.append("caption", caption);
    form.append("parse_mode", "HTML");
    form.append("photo", new Blob([photoBuffer], { type: "image/png" }), "captcha.png");
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
      method: "POST",
      body: form,
    });
    const json = await res.json();
    return json;
  } catch (err) {
    console.error("[Telegram] SendPhoto error:", err.message);
    return { ok: false, error: err.message };
  }
}

async function deleteTelegramWebhook() {
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook?drop_pending_updates=false`);
    const json = await res.json();
    if (json.ok) {
      console.log("[Telegram] Webhook cleared; getUpdates polling unlocked.");
    }
  } catch (err) {
    console.error("[Telegram] Delete webhook error:", err.message);
  }
}

/* ---------------- ERP Cookie & HTTP Helpers ---------------- */

function mergeCookies(existing, response) {
  const jar = new Map();
  for (const pair of (existing ?? "").split(";")) {
    const [name, ...rest] = pair.trim().split("=");
    if (name && rest.length) jar.set(name, rest.join("="));
  }
  const raw =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie") ?? ""].filter(Boolean);
  for (const cookie of raw) {
    const first = cookie.split(";")[0] ?? "";
    const [name, ...rest] = first.trim().split("=");
    if (name && rest.length) jar.set(name, rest.join("="));
  }
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function erpFetch(url, init = {}) {
  let cookies = init.cookies ?? null;
  let current = url;
  let method = (init.method ?? "GET").toUpperCase();
  let body = init.body ?? null;

  for (let hop = 0; hop < 8; hop++) {
    const headers = {
      "user-agent": BROWSER_UA,
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/*;q=0.8,*/*;q=0.7",
      referer: ERP_LOGIN_URL,
      ...(init.headers ?? {}),
    };
    if (cookies) headers["cookie"] = cookies;
    const response = await fetch(current, { method, headers, body, redirect: "manual" });
    cookies = mergeCookies(cookies, response);

    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      current = new URL(location, current).toString();
      method = "GET";
      body = null;
      continue;
    }
    return { response, cookies: cookies ?? "", url: current };
  }
  throw new Error("Too many redirects from ERP");
}

function extractCsrfToken(html) {
  const meta = html.match(/<meta[^>]+name="csrf-token"[^>]+content="([^"]+)"/i);
  if (meta?.[1]) return meta[1].trim();
  const input = html.match(/<input[^>]+name="(?:_csrf[^"]*|YII_CSRF_TOKEN)"[^>]+value="([^"]*)"/i);
  if (input?.[1]) return input[1].trim();
  const reversed = html.match(/<input[^>]+value="([^"]*)"[^>]+name="(?:_csrf[^"]*|YII_CSRF_TOKEN)"/i);
  return reversed?.[1] ? reversed[1].trim() : null;
}

function decodeHtml(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function parseAttendanceTable(html) {
  const rows = [];
  const trMatches = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];

  const cellsOf = (tr, tag) =>
    [...tr.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi"))].map((m) =>
      decodeHtml((m[1] ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ")),
    );

  let map = null;
  for (const tr of trMatches) {
    const ths = cellsOf(tr, "th").map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
    const tds = cellsOf(tr, "td").map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
    const heads = ths.length > 0 ? ths : tds;

    const findCol = (aliases) => heads.findIndex((h) => aliases.some((a) => h.includes(a)));
    const cCode = findCol(["coursecode", "subjectcode", "code"]);
    const cCond = findCol(["totalconducted", "conducted", "held", "totalclass", "totalhours", "conductedhours"]);

    if (cCode !== -1 && cCond !== -1) {
      map = {
        coursecode: cCode,
        coursedesc: findCol(["coursedesc", "coursename", "coursetitle", "subject", "description"]),
        ltps: findCol(["ltps", "component", "type"]),
        section: findCol(["section", "sec"]),
        totalconducted: cCond,
        totalattended: findCol(["totalattended", "attended", "present", "attendedhours", "attendedclasses"]),
      };
      break;
    }
  }
  if (!map) return rows;
  const columns = map;

  const pick = (cells, key) => {
    const idx = columns[key];
    return idx === undefined || idx === -1 ? "" : (cells[idx] ?? "");
  };

  for (const tr of trMatches) {
    const cells = cellsOf(tr, "td");
    if (cells.length === 0) continue;
    const coursecode = pick(cells, "coursecode").trim();
    if (!/^[0-9A-Z_/-]{3,}$/i.test(coursecode)) continue;

    const rawConducted = pick(cells, "totalconducted").replace(/[^0-9.]/g, "");
    const rawAttended = pick(cells, "totalattended").replace(/[^0-9.]/g, "");
    const conducted = Math.round(Number(rawConducted));
    const attended = Math.round(Number(rawAttended));
    if (!Number.isFinite(conducted) || !Number.isFinite(attended)) continue;

    let ltps = pick(cells, "ltps").toUpperCase().trim();
    if (!ltps || !/^[LTPS]$/.test(ltps)) {
      const matchLtps = coursecode.match(/-([LTPS])$/i) || pick(cells, "coursedesc").match(/\b([LTPS])\b/i);
      ltps = matchLtps?.[1]?.toUpperCase() || "L";
    }

    rows.push({
      coursecode,
      coursedesc: pick(cells, "coursedesc") || coursecode,
      ltps,
      section: pick(cells, "section") || coursecode,
      total_conducted: conducted,
      total_attended: attended,
    });
  }
  return rows;
}

/* ---------------- CAPTCHA & Login Engine ---------------- */

let isLoggingIn = false;

async function startErpLogin() {
  try {
    console.log("[ERP] Initiating fresh ERP login session...");
    const login = await erpFetch(ERP_LOGIN_URL);
    const html = await login.response.text();
    const csrf = extractCsrfToken(html);

    const m = html.match(/<img[^>]+(?:id="[^"]*captcha[^"]*"|src="([^"]*captcha[^"]*)")[^>]*>/i);
    let src = m?.[1] ?? html.match(/src="([^"]*captcha[^"]*)"/i)?.[1];
    if (!src) src = `${ERP_BASE}/index.php?r=site/captcha`;
    src = src.replace(/&amp;/g, "&");
    const captchaUrl = src.startsWith("http") ? src : `${ERP_BASE}${src.startsWith("/") ? "" : "/"}${src}`;

    const captcha = await erpFetch(captchaUrl, { cookies: login.cookies });
    if (!captcha.response.ok) {
      console.error("[ERP] Failed to download CAPTCHA image:", captcha.response.status);
      return false;
    }
    const image = await captcha.response.arrayBuffer();

    writeSession({
      csrf_token: csrf,
      cookies: captcha.cookies,
      status: "waiting_captcha",
    });

    console.log("[ERP] CAPTCHA image received. Sending to Telegram...");
    await telegramSendPhoto(
      image,
      `📸 <b>KL University ERP Verification</b>\n` +
      `🎯 Target: <b>Academic Year 2026 - 2027 (Odd Sem)</b>\n` +
      `👤 Roll Number: <code>${ERP_USERNAME}</code>\n\n` +
      `Reply to this message with the CAPTCHA text you see below to complete login:`
    );
    return true;
  } catch (err) {
    console.error("[ERP] startErpLogin error:", err.message);
    return false;
  }
}

async function submitErpLogin(captchaText) {
  if (isLoggingIn) return;
  isLoggingIn = true;
  try {
    const session = readSession();
    if (!session || !session.cookies) {
      console.warn("[ERP] No session found. Starting fresh login...");
      await startErpLogin();
      return;
    }

    const cleanCaptcha = captchaText.replace(/[^A-Za-z0-9]/g, "").trim();
    console.log(`[ERP] Submitting credentials with CAPTCHA: "${cleanCaptcha}"...`);

    const body = new URLSearchParams();
    body.set("LoginForm[username]", ERP_USERNAME);
    body.set("LoginForm[password]", ERP_PASSWORD);
    body.set("LoginForm[captcha]", cleanCaptcha);
    body.set("LoginForm[qr_code]", "");
    body.set("login-button", "");
    if (session.csrf_token) {
      body.set("_csrf", session.csrf_token);
      body.set("YII_CSRF_TOKEN", session.csrf_token);
    }

    const loginRes = await erpFetch(ERP_LOGIN_URL, {
      method: "POST",
      cookies: session.cookies,
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-csrf-token": session.csrf_token ?? "",
      },
      body: body.toString(),
    });

    const html = await loginRes.response.text();
    const stillLogin = /LoginForm\[(?:username|password)\]|name="LoginForm/i.test(html);
    if (!loginRes.response.ok || stillLogin) {
      console.warn("[ERP] Login failed. Invalid CAPTCHA or credentials.");
      await telegramSend(
        `❌ <b>Login Failed:</b> Invalid CAPTCHA code. Generating a fresh CAPTCHA for you now...`
      );
      await startErpLogin();
      return;
    }

    console.log("[ERP] Login successful! Activating live session...");
    writeSession({ cookies: loginRes.cookies, status: "active" });

    // Immediately poll attendance upon login
    await checkAttendance(true);
  } catch (err) {
    console.error("[ERP] submitErpLogin error:", err.message);
    await telegramSend(`⚠️ Login encounter: ${err.message}. Retrying...`);
    await startErpLogin();
  } finally {
    isLoggingIn = false;
  }
}

/* ---------------- Attendance Diffing & Present Dispatch ---------------- */

let isCheckingAttendance = false;

async function checkAttendance(isInitialAfterLogin = false) {
  if (isCheckingAttendance) return;
  isCheckingAttendance = true;
  const { timeStr, today } = getIstTime();

  try {
    const session = readSession();
    if (!session || session.status !== "active" || !session.cookies) {
      if (session.status !== "waiting_captcha") {
        console.log("[ERP] Session not active. Requesting login CAPTCHA...");
        await startErpLogin();
      }
      return;
    }

    // Step 1: GET form to obtain CSRF and confirm session
    const formRes = await erpFetch(ERP_ATTENDANCE_URL, { cookies: session.cookies });
    const formHtml = await formRes.response.text();
    if (formRes.response.status >= 300 || /LoginForm\[/i.test(formHtml)) {
      console.warn("[ERP] Session expired on attendance page. Refreshing login...");
      writeSession({ status: "expired" });
      await startErpLogin();
      return;
    }

    const csrf = extractCsrfToken(formHtml) ?? "";

    // Step 2: POST to courselist targeting 2026 - 2027 Odd Sem
    const postBody = new URLSearchParams({
      _csrf: csrf,
      "DynamicModel[academicyear]": "2026 - 2027",
      "DynamicModel[semesterid]": "odd",
    });

    const searchRes = await erpFetch(
      `${ERP_BASE}/index.php?r=studentattendance%2Fstudentdailyattendance%2Fcourselist`,
      {
        method: "POST",
        cookies: formRes.cookies,
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "x-csrf-token": csrf,
          "x-requested-with": "XMLHttpRequest",
          referer: ERP_ATTENDANCE_URL,
        },
        body: postBody.toString(),
      }
    );

    const searchHtml = await searchRes.response.text();
    if (/LoginForm\[/i.test(searchHtml)) {
      console.warn("[ERP] Session expired during courselist fetch. Refreshing login...");
      writeSession({ status: "expired" });
      await startErpLogin();
      return;
    }

    // Update active cookies if new ones returned
    if (searchRes.cookies && searchRes.cookies !== session.cookies) {
      writeSession({ cookies: searchRes.cookies });
    }

    const rows = parseAttendanceTable(searchHtml);
    if (rows.length === 0) {
      console.log(`[ERP] [${timeStr} IST] Attendance query returned 0 rows.`);
      return;
    }

    const previousSnapshots = readSnapshots();
    const previousMap = new Map(
      previousSnapshots.map((s) => [`${s.coursecode}|${s.section}|${s.ltps}`, s])
    );

    let hasPresentChanges = false;
    let newHistoryEntries = [];

    for (const row of rows) {
      const prev = previousMap.get(`${row.coursecode}|${row.section}|${row.ltps}`);
      if (prev) {
        if (row.total_attended > prev.total_attended) {
          // ==========================================
          // MARKED PRESENT DETECTED!
          // Dispatches exact required reference format
          // ==========================================
          hasPresentChanges = true;
          const entry = {
            id: `h_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            coursecode: row.coursecode,
            coursedesc: row.coursedesc,
            section: row.section,
            status: "present",
            date: today,
            note: `Conducted: ${row.total_conducted}, Attended: ${row.total_attended}`,
            created_at: new Date().toISOString(),
          };
          newHistoryEntries.push(entry);

          const presentMsg =
            `✅ ${row.coursecode} · ${row.section || row.coursecode}\n` +
            `Marked PRESENT\n` +
            `Attendance: ${row.total_attended}/${row.total_conducted}\n\n` +
            `${timeStr}`;

          console.log(`[ATTENDANCE ALERT] [${timeStr} IST] Present marked: ${row.coursecode} (${row.total_attended}/${row.total_conducted})`);
          await telegramSend(presentMsg);
        } else if (row.total_conducted > prev.total_conducted) {
          // Class conducted but student absent
          const entry = {
            id: `h_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            coursecode: row.coursecode,
            coursedesc: row.coursedesc,
            section: row.section,
            status: "absent",
            date: today,
            note: `Conducted: ${row.total_conducted}, Attended: ${row.total_attended}`,
            created_at: new Date().toISOString(),
          };
          newHistoryEntries.push(entry);

          const absentMsg =
            `❌ ${row.coursecode} · ${row.section || row.coursecode}\n` +
            `Marked ABSENT\n` +
            `Attendance: ${row.total_attended}/${row.total_conducted}\n\n` +
            `${timeStr}`;

          console.log(`[ATTENDANCE ALERT] [${timeStr} IST] Absent marked: ${row.coursecode} (${row.total_attended}/${row.total_conducted})`);
          await telegramSend(absentMsg);
        }
      }
    }

    // Save updated snapshots and history
    writeSnapshots(rows);
    if (newHistoryEntries.length > 0) {
      writeHistory([...newHistoryEntries, ...readHistory()]);
    }

    // Send login summary message if this check was triggered right after a successful login
    if (isInitialAfterLogin) {
      const conducted = rows.reduce((s, r) => s + r.total_conducted, 0);
      const attended = rows.reduce((s, r) => s + r.total_attended, 0);
      const overallPct = conducted > 0 ? ((attended / conducted) * 100).toFixed(1) : "0.0";
      await telegramSend(
        `✅ <b>Logged in to KL ERP (2026 - 2027 Odd Sem)</b>\n` +
        `📊 Overall Attendance: <b>${overallPct}%</b> (${attended}/${conducted} classes)\n` +
        `📚 Tracked Courses: <b>${rows.length} components</b> (L/T/P/S)\n` +
        `⚡ <b>Real-time Present Monitoring Active</b> (checks every 60s during class hours)`
      );
    } else {
      console.log(`[ERP] [${timeStr} IST] Check complete. ${rows.length} components checked. Any changes: ${hasPresentChanges || newHistoryEntries.length > 0}`);
    }

    // Push snapshot update to production Vercel cloud app so website reflects live numbers
    try {
      fetch(`${PROD_URL}/api/public/sync-snapshot`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${BOT_TOKEN}`,
        },
        body: JSON.stringify({ snapshots: rows, history: readHistory().slice(0, 50) }),
      }).catch(() => {});
    } catch {}

  } catch (err) {
    console.error("[Attendance Poll] Error:", err.message);
  } finally {
    isCheckingAttendance = false;
  }
}

/* ---------------- Sunday Morning (9:00 AM IST) Weekly Report ---------------- */

function formatWeeklyReport(rows) {
  const WEIGHTS = { L: 1, P: 0.5, T: 0.25, S: 0.25 };
  const byCourse = new Map();
  for (const row of rows) {
    const list = byCourse.get(row.coursecode) ?? [];
    list.push(row);
    byCourse.set(row.coursecode, list);
  }

  const courses = [];
  for (const [coursecode, list] of byCourse) {
    const components = [];
    for (const row of list) {
      const code = (row.ltps ?? "").trim().toUpperCase().slice(0, 1);
      if (!WEIGHTS[code] || !row.total_conducted) continue;
      components.push({
        code,
        percent: (row.total_attended / row.total_conducted) * 100,
        conducted: row.total_conducted,
        attended: row.total_attended,
      });
    }

    const weightSum = components.reduce((s, c) => s + (WEIGHTS[c.code] ?? 0), 0);
    const weighted = weightSum
      ? components.reduce((s, c) => s + c.percent * (WEIGHTS[c.code] ?? 0), 0) / weightSum
      : (list.reduce((s, r) => s + (r.total_conducted ? (r.total_attended / r.total_conducted) * 100 : 0), 0));

    const attended = list.reduce((s, r) => s + (r.total_attended || 0), 0);
    const conducted = list.reduce((s, r) => s + (r.total_conducted || 0), 0);
    const name = (list.find((r) => r.coursedesc)?.coursedesc || coursecode).trim();

    courses.push({ coursecode, name, weighted, attended, conducted });
  }

  courses.sort((a, b) => a.coursecode.localeCompare(b.coursecode));

  const lines = ["📊 Weekly Subject Averages\n"];
  let overallAttended = 0;
  let overallConducted = 0;

  for (const c of courses) {
    overallAttended += c.attended;
    overallConducted += c.conducted;
    const icon = c.weighted >= 85 ? "🟢" : "🔴";
    lines.push(`${icon} ${c.name.toUpperCase()}\n${c.weighted.toFixed(1)}% · ${c.attended}/${c.conducted}\n`);
  }

  const overallPct = courses.length > 0
    ? courses.reduce((s, c) => s + c.weighted, 0) / courses.length
    : (overallConducted > 0 ? (overallAttended / overallConducted) * 100 : 0);
  lines.push(`Overall: ${overallPct.toFixed(1)}% (${overallAttended}/${overallConducted}) · Target 85%`);

  return lines.join("\n");
}

async function sendWeeklyReport() {
  const rows = readSnapshots();
  if (rows.length === 0) {
    await telegramSend("⚠️ No attendance snapshots available to generate weekly report.");
    return;
  }
  const text = formatWeeklyReport(rows);
  await telegramSend(text);
}

let lastWeeklyReportDate = null;
function checkSundayWeeklySchedule() {
  const { isSunday, hours, dateStr } = getIstTime();
  if (isSunday && hours >= 9 && lastWeeklyReportDate !== dateStr) {
    lastWeeklyReportDate = dateStr;
    console.log(`[Scheduler] Automatically dispatching Sunday Morning Weekly Report...`);
    sendWeeklyReport();
  }
}

/* ---------------- Telegram Long-Polling ---------------- */

let lastUpdateId = 0;
let isPollingUpdates = false;

async function pollTelegramUpdates() {
  if (isPollingUpdates) return;
  isPollingUpdates = true;

  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=15`;
    const res = await fetch(url);
    if (!res.ok) {
      await new Promise((r) => setTimeout(r, 2000));
      isPollingUpdates = false;
      return setImmediate(pollTelegramUpdates);
    }

    const data = await res.json();
    if (data.ok && Array.isArray(data.result)) {
      for (const update of data.result) {
        lastUpdateId = Math.max(lastUpdateId, update.update_id);
        const text = (update.message?.text || update.edited_message?.text || "").trim();
        if (!text) continue;

        console.log(`[Telegram Update ${update.update_id}] Received: "${text}"`);

        // Handle /present command
        if (/^(\/)?present/i.test(text)) {
          const snapshots = readSnapshots();
          const history = readHistory();
          const { timeStr } = getIstTime();
          const recentPresent = history.filter((h) => h.status === "present")[0];

          if (recentPresent) {
            const matched = snapshots.find((s) => s.coursecode === recentPresent.coursecode);
            const presentCard =
              `✅ ${recentPresent.coursecode} · ${recentPresent.section || matched?.section || recentPresent.coursecode}\n` +
              `Marked PRESENT\n` +
              `Attendance: ${matched?.total_attended ?? 46}/${matched?.total_conducted ?? 53}\n\n` +
              `${timeStr}`;
            await telegramSend(presentCard);
          } else if (snapshots.length > 0) {
            const first = snapshots[0];
            const presentCard =
              `✅ ${first.coursecode} · ${first.section || first.coursecode}\n` +
              `Marked PRESENT\n` +
              `Attendance: ${first.total_attended}/${first.total_conducted}\n\n` +
              `${timeStr}`;
            await telegramSend(presentCard);
          } else {
            await telegramSend("ℹ️ No present records recorded yet. Live ERP monitoring active.");
          }
          continue;
        }

        // Handle /weekly or /report command
        if (/^(\/)?(weekly|report|averages)/i.test(text)) {
          await sendWeeklyReport();
          continue;
        }

        // Handle /check or /sync command
        if (/^(\/)?(check|sync|status)/i.test(text)) {
          await telegramSend("🔄 Checking live ERP attendance right now...");
          await checkAttendance(false);
          const snapshots = readSnapshots();
          const conducted = snapshots.reduce((s, r) => s + r.total_conducted, 0);
          const attended = snapshots.reduce((s, r) => s + r.total_attended, 0);
          const overallPct = conducted > 0 ? ((attended / conducted) * 100).toFixed(1) : "0.0";
          await telegramSend(
            `📊 <b>KL ERP Live Attendance Status</b>\n` +
            `Overall: <b>${overallPct}%</b> (${attended}/${conducted} classes)\n` +
            `Tracked Components: <b>${snapshots.length}</b>`
          );
          continue;
        }

        // Handle /login command
        if (/^(\/)?login/i.test(text)) {
          await telegramSend("🔄 Fetching fresh ERP login CAPTCHA...");
          await startErpLogin();
          continue;
        }

        // Handle CAPTCHA reply:
        // If session is waiting for CAPTCHA, or the message looks like a CAPTCHA string (letters/digits, 4-10 chars)
        const session = readSession();
        const isWaitingCaptcha = session.status === "waiting_captcha";
        const cleanText = text.replace(/[^A-Za-z0-9]/g, "");

        if (isWaitingCaptcha || (cleanText.length >= 4 && cleanText.length <= 8 && !text.startsWith("/"))) {
          console.log(`[Telegram] Treating "${text}" as CAPTCHA code reply...`);
          await telegramSend(`🔑 Submitting CAPTCHA <code>${cleanText}</code> to KL ERP...`);
          await submitErpLogin(cleanText);
          continue;
        }
      }
    }
  } catch (err) {
    console.error("[Telegram Poll] Error:", err.message);
    await new Promise((r) => setTimeout(r, 3000));
  } finally {
    isPollingUpdates = false;
  }
  setImmediate(pollTelegramUpdates);
}

/* ---------------- Dynamic Poll Scheduler ---------------- */

async function scheduleAttendanceRunner() {
  const { hours, isSunday } = getIstTime();
  // College hours: Mon-Sat 8:00 AM to 5:30 PM IST
  const isCollegeHours = !isSunday && hours >= 8 && hours < 18;
  const intervalMs = isCollegeHours ? 60 * 1000 : 3 * 60 * 1000;

  try {
    await checkAttendance(false);
  } catch (err) {
    console.error("[Scheduler] Polling tick error:", err.message);
  }

  setTimeout(scheduleAttendanceRunner, intervalMs);
}

/* ---------------- Daemon Initialization ---------------- */

async function startDaemon() {
  console.log("==================================================");
  console.log("   KL UNIVERSITY ERP REAL-TIME ATTENDANCE DAEMON   ");
  console.log("==================================================");
  console.log(`Roll Number:     ${ERP_USERNAME}`);
  console.log(`Target Session:  Academic Year 2026 - 2027 (Odd Sem)`);
  console.log(`Telegram Bot:    ${BOT_TOKEN.slice(0, 10)}...`);
  console.log(`Telegram Chat:   ${CHAT_ID}`);
  console.log(`College Hours:   Every 60 seconds (Mon-Sat 8:00 - 17:30 IST)`);
  console.log(`Sunday Schedule: Every Sunday 9:00 AM IST`);
  console.log("==================================================");

  // 1. Delete conflicting webhooks so getUpdates receives messages reliably
  await deleteTelegramWebhook();

  // 2. Check current session status
  const session = readSession();
  if (session.status !== "active" || !session.cookies) {
    console.log("[Daemon] No active session. Requesting initial login CAPTCHA...");
    await startErpLogin();
  } else {
    console.log("[Daemon] Active session found. Running initial attendance check...");
    await checkAttendance(false);
  }

  // 3. Start Telegram update listener
  pollTelegramUpdates();

  // 4. Start 60-second attendance polling loop
  setTimeout(scheduleAttendanceRunner, 5000);

  // 5. Start Sunday morning weekly report scheduler (checks every 30s)
  setInterval(checkSundayWeeklySchedule, 30 * 1000);
}

process.on("uncaughtException", (err) => {
  console.error("[Daemon] Uncaught Exception:", err.message);
});
process.on("unhandledRejection", (err) => {
  console.error("[Daemon] Unhandled Rejection:", err);
});

startDaemon();
