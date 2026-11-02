import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

export const ERP_BASE = "https://newerp.kluniversity.in";
export const ERP_LOGIN_URL = `${ERP_BASE}/index.php?r=site/login`;
export const ERP_ATTENDANCE_URL = `${ERP_BASE}/index.php?r=studentattendance/studentdailyattendance/searchgetinput`;

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

export function isSupabaseConfigured(): boolean {
  const url = process.env["SUPABASE_URL"] || "";
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"] || "";
  return Boolean(url && !url.includes("YOUR-PROJECT-REF") && key && !key.includes("YOUR_"));
}

export function admin(): SupabaseClient {
  const url = process.env["SUPABASE_URL"] || "https://placeholder.supabase.co";
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"] || "placeholder-key";
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type ErpSession = {
  id: number;
  csrf_token: string | null;
  cookies: string | null;
  status: string;
};

const SESSION_FILE = path.join(process.cwd(), ".erp-session.json");
const SNAPSHOTS_FILE = path.join(process.cwd(), ".erp-attendance.json");
const SETTINGS_FILE = path.join(process.cwd(), ".app-settings.json");

export async function isSyncEnabled(db?: SupabaseClient | null): Promise<boolean> {
  if (isSupabaseConfigured() && db) {
    try {
      const { data } = await db.from("app_settings").select("sync_enabled").eq("id", 1).maybeSingle();
      if (data && typeof data.sync_enabled === "boolean") return data.sync_enabled;
    } catch {}
  }
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
      if (typeof parsed.sync_enabled === "boolean") return parsed.sync_enabled;
    }
  } catch {}
  return true; // Default to enabled
}

export async function setSyncEnabled(enabled: boolean, db?: SupabaseClient | null): Promise<void> {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify({ sync_enabled: enabled, updated_at: new Date().toISOString() }, null, 2), "utf-8");
  } catch {}
  if (isSupabaseConfigured() && db) {
    try {
      await db.from("app_settings").update({ sync_enabled: enabled, updated_at: new Date().toISOString() }).eq("id", 1);
    } catch {}
  }
}

function readStoredSession(): ErpSession | null {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      return JSON.parse(fs.readFileSync(SESSION_FILE, "utf-8"));
    }
  } catch {}
  return null;
}

function writeStoredSession(s: ErpSession) {
  try {
    fs.writeFileSync(SESSION_FILE, JSON.stringify(s, null, 2), "utf-8");
  } catch {}
}

function readStoredSnapshots(): any[] | null {
  try {
    if (fs.existsSync(SNAPSHOTS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SNAPSHOTS_FILE, "utf-8"));
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch {}
  return null;
}

function writeStoredSnapshots(rows: any[]) {
  try {
    fs.writeFileSync(SNAPSHOTS_FILE, JSON.stringify(rows, null, 2), "utf-8");
  } catch {}
}

let localMemorySession: ErpSession = readStoredSession() ?? {
  id: 1,
  csrf_token: null,
  cookies: null,
  status: "expired",
};

export const DEFAULT_COURSES: (AttendanceRow & { updated_at: string })[] = [
  { coursecode: "24CI3201", coursedesc: "ADAPTIVE SOFTWARE ENGINEERING", ltps: "L", section: "24CI3201", total_conducted: 53, total_attended: 46, updated_at: new Date().toISOString() },
  { coursecode: "24CI3201", coursedesc: "ADAPTIVE SOFTWARE ENGINEERING", ltps: "P", section: "24CI3201", total_conducted: 31, total_attended: 22, updated_at: new Date().toISOString() },
  { coursecode: "24CS3207", coursedesc: "QUANTUM COMPUTING", ltps: "L", section: "24CS3207", total_conducted: 57, total_attended: 45, updated_at: new Date().toISOString() },
  { coursecode: "24CS3207", coursedesc: "QUANTUM COMPUTING", ltps: "P", section: "24CS3207", total_conducted: 24, total_attended: 18, updated_at: new Date().toISOString() },
  { coursecode: "24CS2235F", coursedesc: "COMPILER DESIGN", ltps: "L", section: "24CS2235F", total_conducted: 44, total_attended: 36, updated_at: new Date().toISOString() },
  { coursecode: "24CS2235F", coursedesc: "COMPILER DESIGN", ltps: "P", section: "24CS2235F", total_conducted: 26, total_attended: 26, updated_at: new Date().toISOString() },
  { coursecode: "24CS3105", coursedesc: "INFORMATION ASSURANCE AND SECURITY", ltps: "L", section: "24CS3105", total_conducted: 58, total_attended: 51, updated_at: new Date().toISOString() },
  { coursecode: "24CS3105", coursedesc: "INFORMATION ASSURANCE AND SECURITY", ltps: "T", section: "24CS3105", total_conducted: 37, total_attended: 34, updated_at: new Date().toISOString() },
  { coursecode: "24DEA3101", coursedesc: "FUNDAMENTALS OF DATA ENGINEERING", ltps: "L", section: "24DEA3101", total_conducted: 44, total_attended: 35, updated_at: new Date().toISOString() },
  { coursecode: "24DEA3101", coursedesc: "FUNDAMENTALS OF DATA ENGINEERING", ltps: "P", section: "24DEA3101", total_conducted: 38, total_attended: 35, updated_at: new Date().toISOString() },
  { coursecode: "24SDCS03", coursedesc: "SOA PROGRAMMING AND MICROSERVICES", ltps: "L", section: "24SDCS03", total_conducted: 32, total_attended: 27, updated_at: new Date().toISOString() },
  { coursecode: "24SDCS03", coursedesc: "SOA PROGRAMMING AND MICROSERVICES", ltps: "S", section: "24SDCS03", total_conducted: 59, total_attended: 44, updated_at: new Date().toISOString() },
  { coursecode: "24CC3014", coursedesc: "AWS CERTIFIED SOLUTIONS ARCHITECT - ASSOCIATE (SAA-C03)", ltps: "S", section: "24CC3014", total_conducted: 36, total_attended: 34, updated_at: new Date().toISOString() },
];

export const DEFAULT_HISTORY = [
  {
    id: "h_1793632962560_elf18",
    coursecode: "24CI3201",
    coursedesc: "ADAPTIVE SOFTWARE ENGINEERING",
    section: "24CI3201",
    status: "present",
    date: "2026-11-02",
    note: "Conducted: 31, Attended: 22",
    created_at: "2026-11-02T15:22:42.560Z",
  },
  {
    id: "h_1793632963423_mglil",
    coursecode: "24CS3105",
    coursedesc: "INFORMATION ASSURANCE AND SECURITY",
    section: "24CS3105",
    status: "present",
    date: "2026-11-02",
    note: "Conducted: 58, Attended: 51",
    created_at: "2026-11-02T15:22:43.423Z",
  },
  {
    id: "h_1793632964347_yaeh0",
    coursecode: "24CS3105",
    coursedesc: "INFORMATION ASSURANCE AND SECURITY",
    section: "24CS3105",
    status: "present",
    date: "2026-11-02",
    note: "Conducted: 37, Attended: 34",
    created_at: "2026-11-02T15:22:44.347Z",
  },
  {
    id: "h_1793608570657_9ysby",
    coursecode: "24CS3207",
    coursedesc: "QUANTUM COMPUTING",
    section: "24CS3207",
    status: "present",
    date: "2026-11-02",
    note: "Conducted: 57, Attended: 45",
    created_at: "2026-11-02T08:36:10.657Z",
  },
  {
    id: "h_1793608571178_sp22p",
    coursecode: "24DEA3101",
    coursedesc: "FUNDAMENTALS OF DATA ENGINEERING",
    section: "24DEA3101",
    status: "present",
    date: "2026-11-02",
    note: "Conducted: 44, Attended: 35",
    created_at: "2026-11-02T08:36:11.178Z",
  },
  {
    id: "h_1793608573058_lvyid",
    coursecode: "24SDCS03",
    coursedesc: "SOA PROGRAMMING AND MICROSERVICES",
    section: "24SDCS03",
    status: "present",
    date: "2026-11-02",
    note: "Conducted: 59, Attended: 44",
    created_at: "2026-11-02T08:36:13.058Z",
  },
  {
    id: "h_1793438418760_xgwz7",
    coursecode: "24SDCS03",
    coursedesc: "SOA PROGRAMMING AND MICROSERVICES",
    section: "24SDCS03",
    status: "present",
    date: "2026-10-31",
    note: "Conducted: 59, Attended: 44",
    created_at: "2026-10-31T09:20:18.760Z",
  },
  {
    id: "h_1793438012556_way8e",
    coursecode: "24CI3201",
    coursedesc: "ADAPTIVE SOFTWARE ENGINEERING",
    section: "24CI3201",
    status: "present",
    date: "2026-10-31",
    note: "Conducted: 53, Attended: 46",
    created_at: "2026-10-31T09:13:32.556Z",
  },
  {
    id: "h_1793437971260_006ib",
    coursecode: "24CI3201",
    coursedesc: "ADAPTIVE SOFTWARE ENGINEERING",
    section: "24CI3201",
    status: "present",
    date: "2026-10-31",
    note: "Conducted: 53, Attended: 46",
    created_at: "2026-10-31T09:12:51.260Z",
  },
  {
    id: "h_1793437901158_czke4",
    coursecode: "24CS3207",
    coursedesc: "QUANTUM COMPUTING",
    section: "24CS3207",
    status: "present",
    date: "2026-10-31",
    note: "Conducted: 55, Attended: 43",
    created_at: "2026-10-31T09:11:41.158Z",
  },
];

export type SemesterOption = {
  key: string;
  label: string;
  academicYear: string;
  semesterId: string;
  courses: (AttendanceRow & { updated_at: string })[];
};

export const SEMESTER_DATA: Record<string, SemesterOption> = {
  "2026-2027_odd": {
    key: "2026-2027_odd",
    label: "2026 – 2027 · Odd Sem (Current)",
    academicYear: "2026 - 2027",
    semesterId: "odd",
    courses: DEFAULT_COURSES,
  },
  "2025-2026_even": {
    key: "2025-2026_even",
    label: "2025 – 2026 · Even Sem",
    academicYear: "2025 - 2026",
    semesterId: "even",
    courses: [
      { coursecode: "23CS2101", coursedesc: "DATABASE MANAGEMENT SYSTEMS", ltps: "L", section: "23CS2101", total_conducted: 48, total_attended: 42, updated_at: new Date().toISOString() },
      { coursecode: "23CS2101", coursedesc: "DATABASE MANAGEMENT SYSTEMS", ltps: "P", section: "23CS2101", total_conducted: 24, total_attended: 22, updated_at: new Date().toISOString() },
      { coursecode: "23CS2102", coursedesc: "OPERATING SYSTEMS", ltps: "L", section: "23CS2102", total_conducted: 46, total_attended: 39, updated_at: new Date().toISOString() },
      { coursecode: "23CS2102", coursedesc: "OPERATING SYSTEMS", ltps: "P", section: "23CS2102", total_conducted: 22, total_attended: 20, updated_at: new Date().toISOString() },
      { coursecode: "23CS2103", coursedesc: "COMPUTER NETWORKS", ltps: "L", section: "23CS2103", total_conducted: 44, total_attended: 38, updated_at: new Date().toISOString() },
      { coursecode: "23CS2103", coursedesc: "COMPUTER NETWORKS", ltps: "P", section: "23CS2103", total_conducted: 20, total_attended: 18, updated_at: new Date().toISOString() },
      { coursecode: "23CS2104", coursedesc: "OBJECT ORIENTED PROGRAMMING USING JAVA", ltps: "L", section: "23CS2104", total_conducted: 40, total_attended: 36, updated_at: new Date().toISOString() },
      { coursecode: "23CS2104", coursedesc: "OBJECT ORIENTED PROGRAMMING USING JAVA", ltps: "P", section: "23CS2104", total_conducted: 24, total_attended: 22, updated_at: new Date().toISOString() },
      { coursecode: "23MT2005", coursedesc: "DISCRETE MATHEMATICAL STRUCTURES", ltps: "L", section: "23MT2005", total_conducted: 50, total_attended: 44, updated_at: new Date().toISOString() },
    ],
  },
  "2025-2026_odd": {
    key: "2025-2026_odd",
    label: "2025 – 2026 · Odd Sem",
    academicYear: "2025 - 2026",
    semesterId: "odd",
    courses: [
      { coursecode: "23CS1201", coursedesc: "DATA STRUCTURES AND ALGORITHMS", ltps: "L", section: "23CS1201", total_conducted: 52, total_attended: 45, updated_at: new Date().toISOString() },
      { coursecode: "23CS1201", coursedesc: "DATA STRUCTURES AND ALGORITHMS", ltps: "P", section: "23CS1201", total_conducted: 26, total_attended: 24, updated_at: new Date().toISOString() },
      { coursecode: "23EC1202", coursedesc: "DIGITAL LOGIC AND COMPUTER DESIGN", ltps: "L", section: "23EC1202", total_conducted: 45, total_attended: 38, updated_at: new Date().toISOString() },
      { coursecode: "23EC1202", coursedesc: "DIGITAL LOGIC AND COMPUTER DESIGN", ltps: "P", section: "23EC1202", total_conducted: 20, total_attended: 19, updated_at: new Date().toISOString() },
      { coursecode: "23MT1203", coursedesc: "PROBABILITY AND STATISTICS", ltps: "L", section: "23MT1203", total_conducted: 48, total_attended: 41, updated_at: new Date().toISOString() },
      { coursecode: "23CS1204", coursedesc: "PYTHON PROGRAMMING FOR DATA SCIENCE", ltps: "S", section: "23CS1204", total_conducted: 36, total_attended: 32, updated_at: new Date().toISOString() },
    ],
  },
  "2024-2025_even": {
    key: "2024-2025_even",
    label: "2024 – 2025 · Even Sem",
    academicYear: "2024 - 2025",
    semesterId: "even",
    courses: [
      { coursecode: "22SC1101", coursedesc: "PROBLEM SOLVING THROUGH C PROGRAMMING", ltps: "L", section: "22SC1101", total_conducted: 50, total_attended: 46, updated_at: new Date().toISOString() },
      { coursecode: "22SC1101", coursedesc: "PROBLEM SOLVING THROUGH C PROGRAMMING", ltps: "P", section: "22SC1101", total_conducted: 28, total_attended: 27, updated_at: new Date().toISOString() },
      { coursecode: "22PH1102", coursedesc: "ENGINEERING PHYSICS", ltps: "L", section: "22PH1102", total_conducted: 44, total_attended: 39, updated_at: new Date().toISOString() },
      { coursecode: "22PH1102", coursedesc: "ENGINEERING PHYSICS", ltps: "P", section: "22PH1102", total_conducted: 20, total_attended: 19, updated_at: new Date().toISOString() },
      { coursecode: "22MT1103", coursedesc: "LINEAR ALGEBRA AND CALCULUS", ltps: "L", section: "22MT1103", total_conducted: 54, total_attended: 48, updated_at: new Date().toISOString() },
      { coursecode: "22EN1104", coursedesc: "TECHNICAL COMMUNICATION SKILLS", ltps: "L", section: "22EN1104", total_conducted: 32, total_attended: 30, updated_at: new Date().toISOString() },
    ],
  },
  "2024-2025_odd": {
    key: "2024-2025_odd",
    label: "2024 – 2025 · Odd Sem",
    academicYear: "2024 - 2025",
    semesterId: "odd",
    courses: [
      { coursecode: "22MT1001", coursedesc: "ENGINEERING MATHEMATICS - I", ltps: "L", section: "22MT1001", total_conducted: 50, total_attended: 45, updated_at: new Date().toISOString() },
      { coursecode: "22EE1002", coursedesc: "BASIC ELECTRICAL AND ELECTRONICS ENGINEERING", ltps: "L", section: "22EE1002", total_conducted: 46, total_attended: 40, updated_at: new Date().toISOString() },
      { coursecode: "22EE1002", coursedesc: "BASIC ELECTRICAL AND ELECTRONICS ENGINEERING", ltps: "P", section: "22EE1002", total_conducted: 22, total_attended: 21, updated_at: new Date().toISOString() },
      { coursecode: "22ME1003", coursedesc: "ENGINEERING GRAPHICS AND DESIGN", ltps: "P", section: "22ME1003", total_conducted: 36, total_attended: 32, updated_at: new Date().toISOString() },
      { coursecode: "22CS1004", coursedesc: "INTRODUCTION TO COMPUTATIONAL THINKING", ltps: "L", section: "22CS1004", total_conducted: 34, total_attended: 31, updated_at: new Date().toISOString() },
    ],
  },
};

const HISTORY_FILE = path.join(process.cwd(), ".erp-history.json");

function readStoredHistory(): any[] | null {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf-8"));
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch {}
  return null;
}

function writeStoredHistory(entries: any[]) {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(entries, null, 2), "utf-8");
  } catch {}
}

let cachedSnapshots: any[] = readStoredSnapshots() ?? [...DEFAULT_COURSES];
let cachedHistory: any[] = readStoredHistory() ?? [...DEFAULT_HISTORY];

export function getCachedSnapshots(): any[] {
  const stored = readStoredSnapshots();
  if (stored && stored.length > 0) {
    cachedSnapshots = stored;
  }
  return cachedSnapshots;
}

export function saveCachedSnapshots(rows: AttendanceRow[]): void {
  cachedSnapshots = rows.map((r) => ({ ...r, updated_at: (r as any).updated_at ?? new Date().toISOString() }));
  writeStoredSnapshots(cachedSnapshots);
}

export function getCachedHistory(): any[] {
  const stored = readStoredHistory();
  if (stored && stored.length > 0) {
    cachedHistory = stored;
  }
  return cachedHistory;
}

export function saveCachedHistory(entries: any[]): void {
  cachedHistory = entries;
  writeStoredHistory(entries);
}

export async function getSession(db?: SupabaseClient | null): Promise<ErpSession | null> {
  if (db && isSupabaseConfigured()) {
    try {
      const { data } = await db.from("erp_session").select("*").eq("id", 1).maybeSingle();
      if (data) return data as ErpSession;
    } catch {}
  }
  if (!localMemorySession.cookies || localMemorySession.status === "expired") {
    const stored = readStoredSession();
    if (stored) localMemorySession = stored;
  }
  return localMemorySession;
}

export async function saveSession(
  db: SupabaseClient | null,
  patch: Partial<Omit<ErpSession, "id">>,
): Promise<void> {
  localMemorySession = { ...localMemorySession, ...patch };
  writeStoredSession(localMemorySession);
  if (db && isSupabaseConfigured()) {
    try {
      await db
        .from("erp_session")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", 1);
    } catch {}
  }
}

/* ---------------- Telegram & ERP Credentials ---------------- */

export const TELEGRAM_BOT_TOKEN = process.env["TELEGRAM_BOT_TOKEN"] || "8613481579:AAGKXxdS4Y9jkJhFpdOQVDXVefCvI2-shtI";
export const TELEGRAM_CHAT_ID = process.env["TELEGRAM_CHAT_ID"] || "7365716186";
export const ERP_USERNAME = process.env["ERP_USERNAME"] || "2420030663";
export const ERP_PASSWORD = process.env["ERP_PASSWORD"] || "Mohith@123";

export function telegramApi(method: string) {
  return `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`;
}

export async function sendTelegram(text: string): Promise<{ ok: boolean; messageId?: number; error?: string }> {
  const chatId = TELEGRAM_CHAT_ID;
  const botToken = TELEGRAM_BOT_TOKEN;
  if (!botToken || !chatId) {
    const err = "Telegram credentials are not configured";
    console.error(`[Telegram] ${err}`);
    return { ok: false, error: err };
  }
  try {
    const res = await fetch(telegramApi("sendMessage"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Telegram] sendMessage failed [${res.status}]: ${errText}`);
      // Fallback: If HTML entity parsing fails (400 Bad Request), retry without HTML formatting
      if (res.status === 400 && errText.includes("can't parse entities")) {
        console.warn("[Telegram] Retrying sendMessage with plain text fallback...");
        const fallbackRes = await fetch(telegramApi("sendMessage"), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: text.replace(/<[^>]+>/g, "") }),
        });
        if (fallbackRes.ok) {
          const json = await fallbackRes.json();
          return { ok: true, messageId: json.result?.message_id };
        }
      }
      return { ok: false, error: `[${res.status}] ${errText}` };
    }
    const json = await res.json();
    return { ok: true, messageId: json.result?.message_id };
  } catch (err) {
    const errStr = String(err);
    console.error("[Telegram] sendMessage exception:", errStr);
    return { ok: false, error: errStr };
  }
}

export async function sendTelegramPhoto(photo: ArrayBuffer, caption: string): Promise<{ ok: boolean; error?: string }> {
  const chatId = TELEGRAM_CHAT_ID;
  const botToken = TELEGRAM_BOT_TOKEN;
  if (!botToken || !chatId) {
    const err = "Telegram credentials are not configured";
    console.error(`[Telegram] ${err}`);
    return { ok: false, error: err };
  }
  try {
    const form = new FormData();
    form.append("chat_id", chatId);
    form.append("caption", caption);
    form.append("parse_mode", "HTML");
    form.append("photo", new Blob([photo], { type: "image/png" }), "captcha.png");
    const res = await fetch(telegramApi("sendPhoto"), { method: "POST", body: form });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Telegram] sendPhoto failed [${res.status}]: ${errText}`);
      // Fallback without parse_mode if entity parsing error
      if (res.status === 400) {
        const fallbackForm = new FormData();
        fallbackForm.append("chat_id", chatId);
        fallbackForm.append("caption", caption.replace(/<[^>]+>/g, ""));
        fallbackForm.append("photo", new Blob([photo], { type: "image/png" }), "captcha.png");
        const fbRes = await fetch(telegramApi("sendPhoto"), { method: "POST", body: fallbackForm });
        if (fbRes.ok) return { ok: true };
      }
      return { ok: false, error: `[${res.status}] ${errText}` };
    }
    return { ok: true };
  } catch (err) {
    const errStr = String(err);
    console.error("[Telegram] sendPhoto exception:", errStr);
    return { ok: false, error: errStr };
  }
}

/**
 * Format a class Present confirmation matching the exact reference format:
 * ✅ 24CI3201 · 24CI3201
 * Marked PRESENT
 * Attendance: 46/53
 * 
 * 14:42
 */
export function formatPresentNotification(
  row: { coursecode: string; section?: string; coursedesc?: string; total_attended: number; total_conducted: number },
  timestamp?: Date,
): string {
  const d = timestamp ?? new Date();
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  const hh = String(ist.getUTCHours()).padStart(2, "0");
  const mm = String(ist.getUTCMinutes()).padStart(2, "0");
  const timeStr = `${hh}:${mm}`;

  return (
    `✅ ${row.coursecode} · ${row.section || row.coursecode}\n` +
    `Marked PRESENT\n` +
    `Attendance: ${row.total_attended}/${row.total_conducted}\n\n` +
    `${timeStr}`
  );
}

/**
 * Compare new attendance rows against previous snapshots, record history,
 * and dispatch immediate Telegram notifications if attendance is marked PRESENT or ABSENT.
 */
export async function checkAndNotifyAttendanceChanges(
  rows: AttendanceRow[],
  db?: SupabaseClient | null,
): Promise<{ changes: string[]; newHistory: any[] }> {
  let previousSnapshots: any[] = [];
  if (db && isSupabaseConfigured()) {
    try {
      const { data } = await db
        .from("attendance_snapshot")
        .select("coursecode, section, ltps, total_conducted, total_attended");
      if (data && data.length > 0) previousSnapshots = data;
    } catch {}
  }
  if (previousSnapshots.length === 0) {
    previousSnapshots = getCachedSnapshots();
  }

  const previous = new Map(
    (previousSnapshots ?? []).map((s) => [`${s.coursecode}|${s.section}|${s.ltps}`, s] as const),
  );

  const istDate = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const today = istDate.toISOString().slice(0, 10);
  const hh = String(istDate.getUTCHours()).padStart(2, "0");
  const mm = String(istDate.getUTCMinutes()).padStart(2, "0");
  const timeStr = `${hh}:${mm}`;

  const changes: string[] = [];
  const newHistoryEntries: any[] = [];

  for (const row of rows) {
    const prev = previous.get(`${row.coursecode}|${row.section}|${row.ltps}`);
    if (prev) {
      if (row.total_attended > prev.total_attended) {
        // Attendance marked PRESENT
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
        changes.push(`${row.coursecode} · ${row.section} (PRESENT)`);
        await sendTelegram(formatPresentNotification(row));
      } else if (row.total_conducted > prev.total_conducted) {
        // Class conducted, student marked ABSENT
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
        changes.push(`${row.coursecode} · ${row.section} (ABSENT)`);
        await sendTelegram(
          `❌ ${row.coursecode} · ${row.section || row.coursecode}\nMarked ABSENT\nAttendance: ${row.total_attended}/${row.total_conducted}\n\n${timeStr}`,
        );
      }
    }
  }

  if (newHistoryEntries.length > 0) {
    saveCachedHistory([...newHistoryEntries, ...getCachedHistory()]);
    if (db && isSupabaseConfigured()) {
      try {
        await db.from("attendance_history").insert(
          newHistoryEntries.map((e) => ({
            coursecode: e.coursecode,
            coursedesc: e.coursedesc,
            section: e.section,
            status: e.status,
            date: e.date,
          })),
        );
      } catch {}
    }
  }

  saveCachedSnapshots(rows);
  if (db && isSupabaseConfigured()) {
    try {
      await db.from("attendance_snapshot").upsert(
        rows.map((r) => ({ ...r, updated_at: new Date().toISOString() })),
        { onConflict: "coursecode,section,ltps" },
      );
    } catch (upsertError: any) {
      console.warn("DB snapshot upsert warning:", upsertError?.message);
    }
  }

  return { changes, newHistory: newHistoryEntries };
}

/**
 * Format the Weekly Subject Averages matching the exact reference format:
 * 📊 Weekly Subject Averages
 * 
 * 🟢 AWS CERTIFIED SOLUTIONS ARCHITECT
 * 97.2% · 35/36
 * 
 * 🟢 ADAPTIVE SOFTWARE ENGINEERING
 * 88.9% · 72/81
 * 
 * 🔴 SOA PROGRAMMING AND MICROSERVICES
 * 83.5% · 76/91
 * 
 * Overall: 89.7% (454/506) · Target 85%
 */
export function formatWeeklyReport(rows: AttendanceRow[]): string {
  const WEIGHTS: Record<string, number> = { L: 1, P: 0.5, T: 0.25, S: 0.25 };
  const byCourse = new Map<string, AttendanceRow[]>();
  for (const row of rows) {
    const list = byCourse.get(row.coursecode) ?? [];
    list.push(row);
    byCourse.set(row.coursecode, list);
  }

  const courses: {
    coursecode: string;
    name: string;
    weighted: number;
    attended: number;
    conducted: number;
  }[] = [];

  for (const [coursecode, list] of byCourse) {
    const components: { code: string; percent: number; conducted: number; attended: number }[] = [];
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

    courses.push({
      coursecode,
      name,
      weighted,
      attended,
      conducted,
    });
  }

  courses.sort((a, b) => a.coursecode.localeCompare(b.coursecode));

  const lines: string[] = ["📊 Weekly Subject Averages\n"];
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

export async function sendWeeklyAttendanceReport(): Promise<{ ok: boolean; messageId?: number; error?: string; text?: string }> {
  let snapshots = getCachedSnapshots();
  if (isSupabaseConfigured()) {
    try {
      const db = admin();
      const { data: snapData } = await db.from("attendance_snapshot").select("*").order("coursecode");
      if (snapData && snapData.length > 0) snapshots = snapData;
    } catch {}
  }
  const text = formatWeeklyReport(snapshots);
  const result = await sendTelegram(text);
  return { ...result, text };
}

/* ---------------- Cookies ---------------- */

export function mergeCookies(existing: string | null, response: Response): string {
  const jar = new Map<string, string>();
  for (const pair of (existing ?? "").split(";")) {
    const [name, ...rest] = pair.trim().split("=");
    if (name && rest.length) jar.set(name, rest.join("="));
  }
  const raw =
    typeof (response.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie ===
    "function"
      ? (response.headers as unknown as { getSetCookie: () => string[] }).getSetCookie()
      : [response.headers.get("set-cookie") ?? ""].filter(Boolean);
  for (const cookie of raw) {
    const first = cookie.split(";")[0] ?? "";
    const [name, ...rest] = first.trim().split("=");
    if (name && rest.length) jar.set(name, rest.join("="));
  }
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

export function erpHeaders(cookies?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "user-agent": BROWSER_UA,
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/*;q=0.8,*/*;q=0.7",
    referer: ERP_LOGIN_URL,
  };
  if (cookies) headers["cookie"] = cookies;
  return headers;
}

/* ---------------- HTML helpers ---------------- */

export function extractCsrfToken(html: string): string | null {
  const meta = html.match(/<meta[^>]+name="csrf-token"[^>]+content="([^"]+)"/i);
  if (meta?.[1]) return decodeHtml(meta[1]);
  const input = html.match(
    /<input[^>]+name="(?:_csrf[^"]*|YII_CSRF_TOKEN)"[^>]+value="([^"]*)"/i,
  );
  if (input?.[1]) return decodeHtml(input[1]);
  const reversed = html.match(
    /<input[^>]+value="([^"]*)"[^>]+name="(?:_csrf[^"]*|YII_CSRF_TOKEN)"/i,
  );
  return reversed?.[1] ? decodeHtml(reversed[1]) : null;
}

export function extractCsrfFieldName(html: string): string {
  const m = html.match(/<input[^>]+name="(_csrf[^"]*|YII_CSRF_TOKEN)"/i);
  return m?.[1] ?? "_csrf";
}

export function extractCaptchaUrl(html: string): string {
  const m = html.match(/<img[^>]+(?:id="[^"]*captcha[^"]*"|src="([^"]*captcha[^"]*)")[^>]*>/i);
  const src = m?.[1] ?? html.match(/src="([^"]*captcha[^"]*)"/i)?.[1];
  if (!src) return `${ERP_BASE}/index.php?r=site/captcha`;
  const decoded = decodeHtml(src);
  if (decoded.startsWith("http")) return decoded;
  return decoded.startsWith("/") ? `${ERP_BASE}${decoded}` : `${ERP_BASE}/${decoded}`;
}

export function looksLikeLoginPage(html: string): boolean {
  return /LoginForm\[(?:username|password)\]|name="LoginForm/i.test(html);
}

export function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim();
}

export type AttendanceRow = {
  coursecode: string;
  coursedesc: string;
  ltps: string;
  section: string;
  total_conducted: number;
  total_attended: number;
};

/** Parse the ERP attendance register table into rows (header-driven). */
export function parseAttendanceTable(html: string): AttendanceRow[] {
  const rows: AttendanceRow[] = [];
  const trMatches = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];

  const cellsOf = (tr: string, tag: "td" | "th") =>
    [...tr.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi"))].map((m) =>
      decodeHtml((m[1] ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ")),
    );

  // Locate the header row and map column names to indexes.
  let map: Record<string, number> | null = null;
  for (const tr of trMatches) {
    const ths = cellsOf(tr, "th").map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
    const tds = cellsOf(tr, "td").map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
    const heads = ths.length > 0 ? ths : tds;

    const findCol = (aliases: string[]) => heads.findIndex((h) => aliases.some((a) => h.includes(a)));

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
  if (!map) {
    // Standard KL University ERP column indexes fallback:
    // 0: #, 1: Coursecode, 2: Coursedesc, 3: Ltps, 4: Section, 5: Year, 6: Sem, 7: FrDate, 8: Total Conducted, 9: Total Attended
    map = {
      coursecode: 1,
      coursedesc: 2,
      ltps: 3,
      section: 4,
      totalconducted: 8,
      totalattended: 9,
    };
  }
  const columns = map;

  const pick = (cells: string[], key: string) => {
    const idx = columns[key];
    return idx === undefined || idx === -1 ? "" : (cells[idx] ?? "");
  };

  for (const tr of trMatches) {
    const cells = cellsOf(tr, "td");
    if (cells.length === 0) continue;
    let coursecode = pick(cells, "coursecode").trim();
    if (!/^[0-9A-Z_/-]{3,}$/i.test(coursecode)) continue;

    const rawConducted = pick(cells, "totalconducted").replace(/[^0-9.]/g, "");
    const rawAttended = pick(cells, "totalattended").replace(/[^0-9.]/g, "");
    const conducted = Math.round(Number(rawConducted));
    const attended = Math.round(Number(rawAttended));
    if (!Number.isFinite(conducted) || !Number.isFinite(attended)) continue;

    let ltps = pick(cells, "ltps").toUpperCase().trim();
    if (!ltps || !/^[LTPS]$/.test(ltps)) {
      // Try to infer from course code or section if available
      const matchLtps = coursecode.match(/-([LTPS])$/i) || pick(cells, "coursedesc").match(/\b([LTPS])\b/i);
      ltps = matchLtps?.[1]?.toUpperCase() || "L";
    }

    rows.push({
      coursecode,
      coursedesc: pick(cells, "coursedesc") || coursecode,
      ltps,
      section: pick(cells, "section") || "S-1",
      total_conducted: conducted,
      total_attended: attended,
    });
  }
  return rows;
}

/**
 * Fetch that follows redirects manually so `Set-Cookie` headers from EVERY hop
 * are collected. Native `redirect: "follow"` exposes only the final response's
 * headers, which silently dropped the load-balancer (`SERVERID`) and Yii
 * session cookies — making every CAPTCHA look "wrong".
 */
export async function erpFetch(
  url: string,
  init: RequestInit & { cookies?: string | null } = {},
): Promise<{ response: Response; cookies: string; url: string }> {
  let cookies = init.cookies ?? null;
  let current = url;
  let method = (init.method ?? "GET").toUpperCase();
  let body: BodyInit | null = (init.body as BodyInit | null) ?? null;

  for (let hop = 0; hop < 8; hop++) {
    const headers: Record<string, string> = {
      ...erpHeaders(cookies),
      ...((init.headers as Record<string, string>) ?? {}),
    };
    if (cookies) headers["cookie"] = cookies;
    const response = await fetch(current, { method, headers, body, redirect: "manual" });
    cookies = mergeCookies(cookies, response);

    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      current = new URL(location, current).toString();
      // Redirected requests always continue as GET without a body.
      method = "GET";
      body = null;
      continue;
    }
    return { response, cookies: cookies ?? "", url: current };
  }
  throw new Error("Too many redirects from ERP");
}

/** Fetch the ERP login page, store the session, and push the CAPTCHA to Telegram + return Base64. */
export async function startErpLogin(): Promise<{
  ok: boolean;
  message: string;
  captchaBase64?: string;
  csrfToken?: string;
}> {
  let db: SupabaseClient | null = null;
  if (isSupabaseConfigured()) {
    try {
      db = admin();
    } catch {}
  }

  const login = await erpFetch(ERP_LOGIN_URL);
  const html = await login.response.text();
  const csrf = extractCsrfToken(html);

  const captcha = await erpFetch(extractCaptchaUrl(html), { cookies: login.cookies });
  if (!captcha.response.ok) {
    return { ok: false, message: `Could not load CAPTCHA (${captcha.response.status})` };
  }
  const image = await captcha.response.arrayBuffer();
  const captchaBase64 = `data:image/png;base64,${Buffer.from(image).toString("base64")}`;

  await saveSession(db, {
    csrf_token: csrf,
    cookies: captcha.cookies,
    status: "waiting_captcha",
  });

  await sendTelegramPhoto(
    image,
    `📸 <b>KL University ERP Verification</b>\n` +
    `🎯 Target: <b>Academic Year 2026 - 2027 (Odd Sem)</b>\n` +
    `👤 Roll Number: <code>${ERP_USERNAME}</code>\n\n` +
    `Reply to this message with the CAPTCHA text you see below to complete login:`
  );
  return { ok: true, message: "CAPTCHA loaded", captchaBase64, csrfToken: csrf ?? undefined };
}

/** Submit ERP login credentials and CAPTCHA, activate session, and immediately poll attendance. */
export async function submitErpLogin(
  username?: string,
  password?: string,
  captchaCode?: string,
): Promise<{ ok: boolean; message: string; rowsParsed?: number; error?: string }> {
  let db: SupabaseClient | null = null;
  if (isSupabaseConfigured()) {
    try {
      db = admin();
    } catch {}
  }

  const session = await getSession(db);
  if (!session || !session.cookies) {
    return { ok: false, message: "No active login session. Please fetch a new CAPTCHA first." };
  }

  const finalUsername = (username || ERP_USERNAME).trim();
  const finalPassword = (password || ERP_PASSWORD).trim();
  const finalCaptcha = (captchaCode || "").replace(/\s+/g, "").trim();

  if (!finalUsername || !finalPassword) {
    return { ok: false, message: "ERP username (roll number) and password are required." };
  }
  if (!finalCaptcha) {
    return { ok: false, message: "CAPTCHA code is required." };
  }

  const body = new URLSearchParams();
  body.set("LoginForm[username]", finalUsername);
  body.set("LoginForm[password]", finalPassword);
  body.set("LoginForm[captcha]", finalCaptcha);
  body.set("LoginForm[qr_code]", "");
  body.set("login-button", "");
  if (session.csrf_token) {
    body.set("_csrf", session.csrf_token);
    body.set("YII_CSRF_TOKEN", session.csrf_token);
  }

  const { response, cookies, url } = await erpFetch(ERP_LOGIN_URL, {
    method: "POST",
    cookies: session.cookies,
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-csrf-token": session.csrf_token ?? "",
    },
    body: body.toString(),
  });

  const html = await response.text();
  const stillLogin = looksLikeLoginPage(html);
  if (!response.ok || stillLogin) {
    const errorBlock =
      html.match(/<div[^>]*class="[^"]*help-block[^"]*"[^>]*>([\s\S]{0,200}?)<\/div>/i)?.[1]
        ?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() ?? "Invalid credentials or CAPTCHA";
    return { ok: false, message: errorBlock, error: errorBlock };
  }

  // Update session
  await saveSession(db, { cookies, status: "active" });

  let rowsCount = 0;
  // Trigger attendance register fetch immediately targeting 2026 - 2027 Odd Sem!
  try {
    const att = await fetchAttendanceHtml(cookies);
    if (att.ok) {
      const rows = parseAttendanceTable(att.html);
      if (rows.length > 0) {
        rowsCount = rows.length;
        await checkAndNotifyAttendanceChanges(rows, db);
        const conducted = rows.reduce((s, r) => s + r.total_conducted, 0);
        const attended = rows.reduce((s, r) => s + r.total_attended, 0);
        const overallPct = conducted > 0 ? ((attended / conducted) * 100).toFixed(1) : "0.0";
        await sendTelegram(
          `✅ <b>Logged in to KL ERP (2026 - 2027 Odd Sem)</b>\n` +
          `📊 Overall Attendance: <b>${overallPct}%</b> (${attended}/${conducted} classes)\n` +
          `📚 Tracked Courses: <b>${rows.length} components</b> (L/T/P/S)\n\n` +
          `💡 Use <code>/bunk dd-mm-yyyy day</code> to test bunk drop!`
        );
      } else {
        await sendTelegram("✅ Logged in to KL University ERP! Live sync activated for 2026 - 2027 Odd Sem.");
      }
    } else {
      await sendTelegram("✅ Logged in to KL University ERP! Ready to sync attendance.");
    }
    if (db) {
      await syncTimetable(db, cookies);
    }
  } catch (err) {
    console.warn("Post-login data sync warning:", err);
  }

  return { ok: true, message: "Logged in successfully!", rowsParsed: rowsCount };
}

/**
 * Extract academic year ID from form HTML.
 * Targets requested academic year (e.g. "2026 - 2027", "2025 - 2026"), defaulting to "2026 - 2027".
 */
export function extractAcademicYearId(formHtml: string, preferred = "2026 - 2027"): string {
  const selectMatch = formHtml.match(/name=["']DynamicModel\[academicyear\]["'][\s\S]*?<\/select>/i);
  const selectContent = selectMatch ? selectMatch[0] : formHtml;

  const optionRegex = /<option\s+value="([^"]*)"[^>]*>([\s\S]*?)<\/option>/gi;
  let match: RegExpExecArray | null;
  const options: { value: string; label: string }[] = [];
  while ((match = optionRegex.exec(selectContent)) !== null) {
    const val = (match[1] ?? "").trim();
    const lbl = (match[2] ?? "").replace(/<[^>]*>/g, "").trim();
    if (val) {
      options.push({ value: val, label: lbl });
    }
  }

  // 1. Look for option where label or value contains the target year pair
  const years = preferred.match(/\d{4}/g) ?? [];
  if (years.length >= 2) {
    const y1 = years[0]!;
    const y2 = years[1]!;
    const exact = options.find(
      (o) =>
        (o.label.includes(y1) && o.label.includes(y2)) ||
        (o.value.includes(y1) && o.value.includes(y2)),
    );
    if (exact) {
      console.log(`[ERP] Selected Academic Year (${preferred}): "${exact.label}" (value=${exact.value})`);
      return exact.value;
    }
  } else if (years.length === 1) {
    const y = years[0]!;
    const partial = options.find((o) => o.label.includes(y) || o.value.includes(y));
    if (partial) {
      console.log(`[ERP] Selected Academic Year (${y}): "${partial.label}" (value=${partial.value})`);
      return partial.value;
    }
  }

  // 2. Default to 2026 - 2027 if preferred not found
  const default2026 = options.find(
    (o) =>
      (o.label.includes("2026") && o.label.includes("2027")) ||
      (o.value.includes("2026") && o.value.includes("2027")),
  );
  if (default2026) return default2026.value;

  // 3. Fallback to first non-empty option
  const fallback = options[0]?.value ?? "";
  console.log(`[ERP] Fallback Academic Year: "${options[0]?.label ?? "unknown"}" (value=${fallback})`);
  return fallback;
}

/**
 * Extract semester ID from form HTML.
 * Targets requested semester ("odd" / "even"), defaulting to "odd".
 */
export function extractSemesterId(formHtml: string, preferred = "odd"): string {
  const isEven = /even|sem\s*2|^2$/i.test(preferred);
  const selectMatch = formHtml.match(/name=["']DynamicModel\[semesterid\]["'][\s\S]*?<\/select>/i);
  if (!selectMatch) return isEven ? "2" : "1";
  const selectContent = selectMatch[0];

  const optionRegex = /<option\s+value="([^"]*)"[^>]*>([\s\S]*?)<\/option>/gi;
  let match: RegExpExecArray | null;
  const options: { value: string; label: string }[] = [];
  while ((match = optionRegex.exec(selectContent)) !== null) {
    const val = (match[1] ?? "").trim();
    const lbl = (match[2] ?? "").replace(/<[^>]*>/g, "").trim();
    if (val) {
      options.push({ value: val, label: lbl });
    }
  }

  const matched = options.find((o) =>
    isEven
      ? /even|sem\s*2|^2$/i.test(o.label) || o.value === "2"
      : /odd|sem\s*1|^1$/i.test(o.label) || o.value === "1",
  );
  if (matched) {
    console.log(`[ERP] Selected Semester (${preferred}): "${matched.label}" (value=${matched.value})`);
    return matched.value;
  }

  return options[0]?.value ?? (isEven ? "2" : "1");
}

/**
 * The attendance register is behind a POST search form (academic year + semester).
 * A plain GET only returns the empty search form, so we submit the form and
 * return the resulting HTML that contains the register table.
 */
export async function fetchAttendanceHtml(
  cookies: string,
  opts: { academicYearId?: string; semesterId?: string } = {},
): Promise<{ html: string; cookies: string; ok: boolean; academicYear?: string; semester?: string }> {
  const form = await erpFetch(ERP_ATTENDANCE_URL, { cookies });
  const formHtml = await form.response.text();
  if (!form.response.ok || looksLikeLoginPage(formHtml)) {
    return { html: formHtml, cookies: form.cookies, ok: false };
  }

  const csrf = extractCsrfToken(formHtml) ?? "";
  const academicYearId = opts.academicYearId || extractAcademicYearId(formHtml, "2026 - 2027");
  const semesterId = opts.semesterId || extractSemesterId(formHtml, "odd");

  console.log(`[ERP] Querying Attendance: AcademicYear="${academicYearId}", Semester="${semesterId}"`);

  const body = new URLSearchParams({
    _csrf: csrf,
    "DynamicModel[academicyear]": academicYearId,
    "DynamicModel[semesterid]": semesterId,
  });

  const search = await erpFetch(`${ERP_BASE}/index.php?r=studentattendance%2Fstudentdailyattendance%2Fcourselist`, {
    method: "POST",
    cookies: form.cookies,
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-csrf-token": csrf,
      "x-requested-with": "XMLHttpRequest",
      referer: ERP_ATTENDANCE_URL,
    },
    body: body.toString(),
  });
  const html = await search.response.text();
  return {
    html,
    cookies: search.cookies,
    ok: search.response.ok && !looksLikeLoginPage(html),
    academicYear: academicYearId,
    semester: semesterId,
  };
}

export const ERP_TIMETABLE_URL = `${ERP_BASE}/index.php?r=studentacademic/studenttimetable/index`;

/** Fetch student timetable HTML from the ERP portal. */
export async function fetchTimetableHtml(
  cookies: string,
): Promise<{ html: string; cookies: string; ok: boolean }> {
  let res = await erpFetch(ERP_TIMETABLE_URL, { cookies });
  let html = await res.response.text();
  if (res.response.ok && !looksLikeLoginPage(html) && /timetable/i.test(html)) {
    return { html, cookies: res.cookies, ok: true };
  }

  // Fallback to daily attendance timetable link if index not available
  const altUrl = `${ERP_BASE}/index.php?r=studentattendance/studentdailyattendance/studenttimetable`;
  res = await erpFetch(altUrl, { cookies: res.cookies });
  html = await res.response.text();
  return {
    html,
    cookies: res.cookies,
    ok: res.response.ok && !looksLikeLoginPage(html),
  };
}

/** Parse ERP timetable HTML table into standard timetable structure. */
export function parseTimetableTable(html: string): Record<string, Record<string, any>> | null {
  const DAYS_LIST = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const DAY_LOOKUP: Record<string, string> = {
    mon: "Mon",
    monday: "Mon",
    tue: "Tue",
    tuesday: "Tue",
    wed: "Wed",
    wednesday: "Wed",
    thu: "Thu",
    thursday: "Thu",
    fri: "Fri",
    friday: "Fri",
    sat: "Sat",
    saturday: "Sat",
  };
  const PERIOD_KEYS = ["P1", "P2", "P3", "P4", "P5", "P7", "P8", "P9", "P10", "P11"];

  const trMatches = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  if (trMatches.length === 0) return null;

  const result: Record<string, Record<string, any>> = {
    Mon: {},
    Tue: {},
    Wed: {},
    Thu: {},
    Fri: {},
    Sat: {},
  };
  for (const d of DAYS_LIST) {
    for (const p of PERIOD_KEYS) {
      result[d]![p] = null;
    }
  }

  let foundEntries = 0;

  for (const tr of trMatches) {
    const cells = [...tr.matchAll(/<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)].map((m) =>
      decodeHtml((m[1] ?? "").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, " ").trim()),
    );
    if (cells.length < 2) continue;

    const firstCell = cells[0]?.toLowerCase().replace(/[^a-z]/g, "") ?? "";
    const matchedDay = DAY_LOOKUP[firstCell];
    if (!matchedDay) continue;

    const periodCells = cells.slice(1);
    periodCells.forEach((cellText, idx) => {
      const pKey = PERIOD_KEYS[idx];
      if (!pKey) return;
      if (!cellText || cellText === "-" || cellText.toLowerCase().includes("nil")) {
        result[matchedDay]![pKey] = null;
        return;
      }
      const codeMatch = cellText.match(/([0-9A-Z]{4,}(?:-[LTPS])?)/i);
      if (!codeMatch) return;
      const coursecode = codeMatch[1]!.toUpperCase();

      const secMatch = cellText.match(/([A-Z]-\d+|SEC(?:TION)?\s*[-:]?\s*\d+)/i);
      const section = secMatch ? secMatch[1]!.toUpperCase() : "S-1";

      const roomMatch = cellText.match(/([A-Z]-\d{3,4}|ROOM\s*[-:]?\s*\w+)/i);
      const room = roomMatch ? roomMatch[1]! : "TBD";

      result[matchedDay]![pKey] = { coursecode, section, room };
      foundEntries++;
    });
  }

  return foundEntries > 0 ? result : null;
}

/** Check ERP timetable and update DB if changed. */
export async function syncTimetable(
  db: SupabaseClient,
  cookies: string,
): Promise<{ ok: boolean; updated: boolean; note?: string }> {
  try {
    const { html, ok } = await fetchTimetableHtml(cookies);
    if (!ok) return { ok: false, updated: false, note: "could not fetch timetable from erp" };

    const parsed = parseTimetableTable(html);
    if (!parsed) return { ok: true, updated: false, note: "no timetable table parsed" };

    const { data: existing } = await db.from("timetable").select("data").eq("id", 1).maybeSingle();
    const existingStr = JSON.stringify(existing?.data ?? {});
    const newStr = JSON.stringify(parsed);

    if (existingStr !== newStr) {
      const { error } = await db.from("timetable").upsert(
        { id: 1, data: parsed, updated_at: new Date().toISOString() },
        { onConflict: "id" },
      );
      if (!error) {
        await sendTelegram(
          "🗓️ <b>Timetable Updated!</b>\nYour class schedule was updated from the KL ERP portal.",
        );
        return { ok: true, updated: true };
      }
    }
    return { ok: true, updated: false, note: "timetable unchanged" };
  } catch (err) {
    console.error("syncTimetable error:", err);
    return { ok: false, updated: false, note: String(err) };
  }
}

