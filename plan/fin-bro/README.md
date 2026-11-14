# finbro — project plan

A private, single-user dashboard at `fin.devshub.xyz` that tracks two things:

1. **Investments**: PSX stocks, mutual funds, money market funds, savings accounts.
2. **Monthly expenses**: subscriptions, plus every other expense (including money given to someone), added through a popup.

Small project, T3 Stack, Mercury-style design in light and dark mode.

## Documents

| File | What it answers |
| --- | --- |
| [research.md](./research.md) | What was checked on the web, what was tested live, what is still unverified |
| [architecture.md](./architecture.md) | Stack, folder layout, data model, API, price sources, security, hosting |
| [design.md](./design.md) | Mercury design system adapted to a dashboard: tokens, type, components, page layouts |
| [phases/](./phases/) | Ten build phases, each with tasks and a "done when" list |
| [../../design-reference.md](../../design-reference.md) | The original Mercury reference (source of truth for brand tokens) |

## Stack in one glance

| Layer | Choice |
| --- | --- |
| Framework | Next.js (App Router) + TypeScript, scaffolded with `create-t3-app` |
| API | tRPC v11 + TanStack Query |
| Database | PostgreSQL + Drizzle ORM |
| Auth | Better Auth, email + password, one user, sign-up disabled |
| UI | Tailwind CSS v4 + shadcn/ui, themed with Mercury tokens |
| Charts | Recharts (through the shadcn Chart component) |
| Forms | react-hook-form + Zod |
| Other | next-themes, lucide-react, sonner, date-fns, cheerio |
| Hosting | Vercel + Neon Postgres, one daily cron |

## Sidebar (matches the sketch: top bar, sidebar left, details right)

```
Overview
INVESTMENTS
  PSX Stocks
  Mutual Funds
  Money Market
  Savings Accounts
EXPENSES
  Monthly Expenses
  Subscriptions
────────
Settings
```

## Status

Built and working as of 2026-11-14: phases 1–10. `pnpm typecheck`, `pnpm lint`,
`pnpm test` (31 tests) and `pnpm build` all pass. What differs from the plan as
written:

| Plan | What was built | Why |
| --- | --- | --- |
| T3 scaffold on Next 15 | Next 16, React 19, Zod 4, Drizzle 0.45, Better Auth 1.7 | Upgraded in Phase 1 while the app was empty |
| Auth from the T3 CLI (Better Auth in the app) | Same: Better Auth runs inside the app, sign-up disabled, owner created by `pnpm user:create` | Neon Auth was offered but you chose the built-in option |
| `/dev/ui` kitchen-sink page | Not built as a separate route | Every real page was reviewed in both themes instead |
| Phase 9 "Subscriptions & To Give" | Subscriptions only; money given to someone is a normal expense under "Payments to people" | Your decision on 2026-11-14 |

## Phases

| # | Phase | Size | Result |
| --- | --- | --- | --- |
| 1 | [Foundation & first deploy](./phases/phase-01-foundation.md) | S | Empty T3 app builds and runs on Vercel with a database |
| 2 | [Design system & app shell](./phases/phase-02-design-system-shell.md) | M | Mercury tokens, light/dark, sidebar + top bar, shared UI pieces |
| 3 | [Auth](./phases/phase-03-auth.md) | S | Login page, protected app, one owner account |
| 4 | [Data model & portfolio math](./phases/phase-04-data-model.md) | M | All tables migrated, tested calculation library |
| 5 | [PSX stocks](./phases/phase-05-psx-stocks.md) | L | Holdings, transactions, live price refresh, reusable holdings UI |
| 6 | [Mutual funds & money market](./phases/phase-06-funds.md) | M | Fund picker, NAV refresh, both pages |
| 7 | [Savings accounts](./phases/phase-07-savings.md) | S | Accounts, deposits, withdrawals, profit |
| 8 | [Monthly expenses](./phases/phase-08-expenses.md) | M | Add-expense popup, month view, categories, charts |
| 9 | [Subscriptions](./phases/phase-09-subscriptions.md) | S | Recurring subscriptions with "Mark paid" |
| 10 | [Overview, daily job & launch](./phases/phase-10-overview-launch.md) | M | Overview page, daily price + snapshot job, live on `fin.devshub.xyz` |

Sizes are relative (S < M < L), not hour estimates. Phases run in order; each one leaves the app working.

## Rules for every phase

- `pnpm typecheck`, `pnpm lint` and `pnpm build` pass before a phase is called done.
- Every new screen is checked in **both** light and dark mode, and at a phone width (390px).
- Every screen has a loading state, an empty state and an error state.
- UI follows [design.md](./design.md). If something is not covered there, extend design.md first, then build.

## Decisions (confirmed 2026-11-14)

1. **Hosting is Vercel + Neon.**
2. **One user (you).** No sign-up page, no sharing, no roles.
3. **PKR only.** No multi-currency.
4. **"Money I have to give to someone" is just an expense.** It is entered by hand through the add-expense popup, under the "Payments to people" category. There is no separate page or list for it.
5. **Transactions are typed in by hand.** No broker or bank statement import.
6. **Live prices are a convenience, not a guarantee.** Both price sources are unofficial (see research.md). Manual price entry always works.

## Not in this project

Multi-currency, budgets and spending limits, bank or broker imports, tax reports (CGT, zakat), lists of money owed to or by people, email or push notifications, a mobile app, multiple users. Each can be added later without reworking the data model.
