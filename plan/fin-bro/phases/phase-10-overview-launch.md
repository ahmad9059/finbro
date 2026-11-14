# Phase 10 — Overview, daily job & launch

**Size:** M · **Depends on:** Phases 5–9

## Goal

The Overview page ties everything together, prices and net-worth history update themselves once a day, and the app is live at `fin.devshub.xyz`.

## Tasks

### Daily job

1. **`server/jobs/daily.ts`:** `runDailyJob()` as described in architecture.md: refresh all prices, compute positions, upsert one `portfolio_snapshot` row per asset kind for today's Pakistan date, return a summary. Running it twice in a day overwrites the same rows.
2. **Route.** `GET /api/cron/daily`: return 401 unless the header is `Authorization: Bearer $CRON_SECRET`. Add `CRON_SECRET` to the env schema and to Vercel.
3. **Schedule.** `vercel.json`:
   ```json
   { "crons": [{ "path": "/api/cron/daily", "schedule": "0 18 * * *" }] }
   ```
   That is 23:00–23:59 Pakistan time (the Hobby plan fires any time within the hour). Confirm in the Vercel docs that the secret header is sent automatically.
4. **First snapshot.** Call the route once by hand so the chart has a starting point.

### Overview page

5. **`overview.get`:** one query returning net worth, total unrealized gain, allocation by asset kind, the snapshot series, this month's spending, subscriptions due in the next 30 days (and overdue), and the top five holdings by value.
6. **KPI row:** Net worth (hero size) · Unrealized gain · Spent this month · Due in 30 days. Each card links to its page.
7. **Allocation donut** with its legend (name, value, percent) for the four asset kinds.
8. **Net-worth line** from the snapshots, with range tabs: 1M · 3M · 1Y · All. Until there are two snapshots it shows an empty state: "Your net-worth history builds up from today."
9. **Upcoming payments** list (five items, overdue first) with "Mark paid" inline. **Top holdings** list (five items).
10. **Brand-new account.** With no data at all, Overview shows a short get-started panel linking to "Add holding" and "Add expense" instead of four zeros.

### Polish

11. **Delete `/dev/ui`.**
12. **Full design pass.** Walk every page against the review checklist in design.md: light, dark, 390px, keyboard only. Fix what fails.
13. **Details:** page titles in the browser tab, a favicon and wordmark, a styled 404 page, a styled error boundary with a retry button.
14. **Speed.** Check that no page waits on a price fetch to render: prices come from the database; fetching happens only in the job and the Refresh button.

### Launch

15. **Domain.** Add `fin.devshub.xyz` in Vercel; create the CNAME record at your DNS provider; wait for HTTPS. Set `BETTER_AUTH_URL=https://fin.devshub.xyz` and redeploy.
16. **Production check:** sign in on the real domain; sign-up endpoint rejected; cron route returns 401 without the secret; `AUTH_ALLOW_SIGNUP` is **not** set in Vercel.
17. **Backups.** Add a `pg_dump "$DATABASE_URL" > backup.sql` command to the README and take the first backup.
18. **Enter your real data** and use the app for a week. Keep a short list of what annoys you; that list is the next project.

## Done when

- [ ] `https://fin.devshub.xyz` serves the login page over HTTPS and you can sign in.
- [ ] The day after launch, prices and a new snapshot row appeared without you doing anything.
- [ ] Overview's net worth equals the sum of the four investment pages' totals.
- [ ] "Spent this month" on Overview equals the Monthly Expenses page.
- [ ] Every page passes the design review checklist.
- [ ] `/dev/ui` is gone, and `typecheck`, `lint`, `test` and `build` all pass.
- [ ] A database backup exists somewhere other than Neon.

## After launch (not planned in detail)

Budgets per category, CSV export, money owed to you, income tracking, per-holding price charts, payment reminders.
