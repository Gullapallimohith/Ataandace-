# Class Companion — KL University Attendance Tracker

A full-stack attendance tracking app for KL University's ERP portal:
a live dark-themed dashboard, a Telegram bot that handles CAPTCHA-based
ERP login and pushes class alerts, and automated backend polling.

## What it does

- **Dashboard** (`/`): overall + per-subject attendance (L-T-P-S weighted),
  weekly timetable (Mon–Sat, periods 1–11) with today/live highlighting,
  attendance log, and a global sync on/off toggle. Updates in real time.
- **ERP sync**: logs into the ERP with your credentials, sends the CAPTCHA
  to your Telegram chat, and polls the attendance page every 10 minutes.
  New marks are written to the database and pushed to Telegram.
- **Class alerts**: 5-minute cron warns you ~2 minutes before each period
  (Asia/Kolkata times) from your weekly schedule.

## Tech stack

- [TanStack Start](https://tanstack.com/start) v1 (React 19, SSR, server
  functions and file-based API routes) on Vite 7 / Nitro (Cloudflare Workers
  compatible).
- Tailwind CSS v4 (theme tokens + `@utility` classes in `src/styles.css`).
- Backend: hosted Postgres with RLS, Realtime, and `pg_cron` schedules.
- Telegram Bot API for login + notifications.

## Project structure

```
src/
  routes/
    __root.tsx                     Root layout, fonts, head metadata
    index.tsx                      Dashboard page
    api/public/
      start-login.ts               GET — kick off ERP login, send CAPTCHA to Telegram
      telegram-webhook.ts          POST — Telegram updates (CAPTCHA replies → login)
      poll-attendance.ts           GET/POST — cron: fetch ERP, diff snapshot, log + notify
      notify-period.ts             GET/POST — cron: pre-period class alerts
      setup-webhook.ts             GET/POST — register the Telegram webhook
      debug-erp.ts                 GET — temporary ERP diagnostics (remove in prod)
  components/
    AttendanceOverview.tsx         Per-course cards (L-T-P-S weighted)
    AttendanceLogList.tsx          Attendance log (present/absent rows)
    WeeklyTimetable.tsx            Timetable grid, today row, live highlight
    SyncToggle.tsx                 Global sync on/off switch
  hooks/
    useAttendanceData.ts           Snapshot + history queries, Realtime, 30s poll
    useSyncSetting.ts              app_settings.sync_enabled (localStorage cached)
  lib/
    timetable.ts                   Period times, weekly schedule, IST helpers
    erp.server.ts                  ERP login/fetch/parse, Telegram send, DB admin
  integrations/supabase/           Auto-generated clients (do not edit)
supabase/migrations/               Schema + RLS + realtime + cron setup
```

## Run locally

Requirements: Node.js 20+ (or Bun), npm.

```sh
npm install
npm run dev
```

The app needs the database URL/key pair from `.env` (publishable keys only —
safe to commit). If you're starting from a fresh clone, copy
`.env.example` to `.env` and fill in your own project values.

- `npm run dev` — dev server
- `npm run build` — production build
- `npm run lint` / `npm run format`

## Backend setup

### Database

The schema lives in `supabase/migrations/`. Apply them with your preferred
workflow (`supabase db push` or the SQL editor):

1. `attendance_snapshot` + `attendance_history` (public read-only RLS,
   service-role writes)
2. `app_settings` (public read/write single row, Realtime enabled)
3. Composite PK `(coursecode, section, ltps)` on the snapshot table
4. Seed `app_settings` row

### Backend secrets

These are configured as server-side environment secrets — never commit them:

- `ERP_USERNAME`, `ERP_PASSWORD` — ERP portal credentials
- `TELEGRAM_BOT_TOKEN` — bot token from @BotFather
- `TELEGRAM_CHAT_ID` — your chat id (@userinfobot)

### Cron schedules

The hosted database runs `pg_cron` jobs hitting the app's public endpoints:

- every 10 min → `GET {origin}/api/public/poll-attendance`
- every 5 min → `GET {origin}/api/public/notify-period`

If you self-host, replace `pg_cron` with any external scheduler
(crontab, GitHub Actions, cron-job.org) calling those two URLs.

## First login flow

1. `GET {origin}/api/public/start-login` → the bot sends the ERP CAPTCHA
   image to your Telegram chat.
2. Reply in Telegram with the CAPTCHA text (whitespace/symbols are ignored).
3. On success the session is stored server-side and polling resumes.
4. If the session expires, the bot automatically sends a fresh CAPTCHA.

## Notes

- `erp_session` (cookies, CSRF token, status) is service-role only — RLS
  blocks every non-service client. Never expose it to the frontend.
- `src/integrations/supabase/*` is auto-generated; do not edit.
- `src/routes/api/public/*` bypasses site auth by design — each handler
  verifies its own caller (cron endpoints are idempotent and safe to expose).
