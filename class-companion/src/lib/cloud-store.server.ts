/**
 * Cloud persistent key-value store for cross-container serverless deduplication.
 * Uses keyvalue.immanuel.co with local memory caching.
 */

const APP_KEY = "npcvqhjt";
const BASE_URL = `https://keyvalue.immanuel.co/api/KeyVal`;

// Local fast cache across warm container executions
const memoryCache = new Map<string, { val: string; exp: number }>();

export async function getCloudKey(key: string): Promise<string | null> {
  const sanitized = key.replace(/[^a-zA-Z0-9_-]/g, "_");
  const cached = memoryCache.get(sanitized);
  if (cached && cached.exp > Date.now()) {
    return cached.val;
  }

  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 2000);
    const res = await fetch(`${BASE_URL}/GetValue/${APP_KEY}/${sanitized}`, {
      signal: ctrl.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const text = await res.json();
    if (text) {
      memoryCache.set(sanitized, { val: String(text), exp: Date.now() + 60000 });
      return String(text);
    }
  } catch {}
  return null;
}

export async function setCloudKey(key: string, value: string): Promise<boolean> {
  const sanitizedKey = key.replace(/[^a-zA-Z0-9_-]/g, "_");
  const sanitizedVal = value.replace(/[^a-zA-Z0-9_-]/g, "_");
  memoryCache.set(sanitizedKey, { val: sanitizedVal, exp: Date.now() + 60000 });

  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 2000);
    const res = await fetch(
      `${BASE_URL}/UpdateValue/${APP_KEY}/${sanitizedKey}/${sanitizedVal}`,
      { method: "POST", signal: ctrl.signal }
    );
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

/** Check if an alert (e.g. 10m reminder or present notification) has already been sent */
export async function isAlertAlreadySent(alertKey: string): Promise<boolean> {
  const val = await getCloudKey(alertKey);
  return val === "1" || val === "sent";
}

/** Mark an alert as sent in the cloud */
export async function markAlertAsSent(alertKey: string): Promise<void> {
  await setCloudKey(alertKey, "1");
}

/** Get persistent attendance count for a course */
export async function getStoredCourseAttendance(
  coursecode: string,
  ltps: string
): Promise<{ attended: number; conducted: number } | null> {
  const key = `att_${coursecode}_${ltps}`;
  const val = await getCloudKey(key);
  if (!val) return null;
  const parts = val.split("_");
  if (parts.length === 2) {
    const attended = parseInt(parts[0]!, 10);
    const conducted = parseInt(parts[1]!, 10);
    if (!isNaN(attended) && !isNaN(conducted)) {
      return { attended, conducted };
    }
  }
  return null;
}

/** Store persistent attendance count for a course */
export async function saveStoredCourseAttendance(
  coursecode: string,
  ltps: string,
  attended: number,
  conducted: number
): Promise<void> {
  const key = `att_${coursecode}_${ltps}`;
  await setCloudKey(key, `${attended}_${conducted}`);
}

