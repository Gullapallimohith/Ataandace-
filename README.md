# Attendance App — KL University Class Companion

A full-stack attendance tracking app for KL University's ERP portal:
a live dashboard, a Telegram bot that handles CAPTCHA-based ERP login and pushes class alerts, and automated backend polling.

## Project Structure

- `class-companion/`: Main application source code (TanStack Start, React 19, Tailwind CSS v4, Telegram Bot integration, ERP scraper).

## Quick Start

```sh
cd class-companion
npm install
npm run dev
```

For background Telegram polling and 10-minute automated attendance monitoring:

```sh
node telegram-poller.mjs
```

See [class-companion/README.md](class-companion/README.md) for full configuration and documentation.

