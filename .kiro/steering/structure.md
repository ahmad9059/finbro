---
inclusion: always
---

# Project structure

```
src/app/          routes: (app) shell pages, (auth) login, api/auth, api/trpc, api/cron, api/logo
src/components/   ui (shadcn), shell (sidebar, top bar), shared, charts
src/features/     investments, savings, expenses, subscriptions, overview, assistant, settings
src/lib/          pure code: portfolio maths, dates, formatting, schemas, categories. Unit-tested.
src/server/       db, better-auth, api routers, assistant (context, tools, prompt), prices, jobs
scripts/          create-user, delete-user, seed-demo, sync-psx-symbols, rate-limit
plan/fin-bro/     research, design system, architecture, build phases
```

- A feature folder owns its client components. Shared pieces go in `src/components/shared`.
- Server-only modules import `server-only`.
- Tests sit next to the code as `*.test.ts` under `src/`.
- Positions (units, average cost, realized and unrealized gain) are derived by `computePosition` in `src/lib/portfolio.ts`. They are never stored.

Architecture detail: #[[file:plan/fin-bro/architecture.md]]
