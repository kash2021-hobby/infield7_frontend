# InField 7 website

Next.js app for managers and for employees on the web. Copy this folder to the VPS on its own. It talks to the API over HTTPS.

`NEXT_PUBLIC_API_URL` is baked in at build time. Set it before `npm run build`.

## Local

```bash
cp .env.example .env.local
# NEXT_PUBLIC_API_URL=http://localhost:4000
npm install
npm run dev
```

Web: http://localhost:3000

## VPS

1. Copy this folder, for example to `/home/YOU/infield7_frontend`.
2. Copy `.env.example` to `.env.production`. Set `NEXT_PUBLIC_API_URL` to the public API host (for example `https://infieldback.ltabai.in`) and `PORT=3002` (or another free port).
3. `sudo bash deploy/install.sh`
4. Add `deploy/nginx.conf` to the Nginx you already run, same as your other sites. Reload Nginx. Add HTTPS the same way you do for the rest of the server.

Update later: copy new files in, then `bash deploy/update.sh`.

Managers open Tasks for a board (drag cards), list, calendar, and route. A task can repeat every day, every week, or weekdays until a date. On the calendar, drag a card to another day. On the list, sort a column and update several rows at once. Route sends today's site order to My visits.

The top bar stays on the page: breadcrumb, search (Ctrl+K or ⌘K), Create, alerts bell, and profile. Field people get search and profile only. Search stays inside this company.

Company setup accepts an optional GSTIN. The check digit is verified here. The GST portal is not called.
