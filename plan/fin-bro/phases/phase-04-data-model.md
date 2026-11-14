# Phase 4 — Data model & portfolio math

**Size:** M · **Depends on:** Phase 3 · **Read first:** [architecture.md](../architecture.md), "Data model" and "Portfolio math"

## Goal

Every table exists, and the money calculations are written and tested before any screen depends on them. No UI in this phase.

## Tasks

1. **Schema.** In `server/db/schema.ts` add the tables from architecture.md: `asset`, `asset_txn`, `portfolio_snapshot`, `expense_category`, `expense`, `subscription`, with their enums, foreign keys and indexes.
   - Money: `numeric({ precision: 18, scale: 2, mode: "number" })`.
   - Units and prices: `numeric({ precision: 18, scale: 4, mode: "number" })`.
   - Dates: `date({ mode: "string" })` (`YYYY-MM-DD`), so no timezone conversion ever touches them.
   - `userId` on every table, cascade on user delete.
2. **Migrate.** `pnpm db:generate`, review the SQL, `pnpm db:migrate` locally and on production.
3. **Shared Zod schemas.** `lib/schemas.ts` with one input schema per form (asset, transaction, expense, category, subscription). Amounts must be positive; units and prices positive where required; dates valid. These are used by both the forms and tRPC.
4. **Transaction rules.** A helper that says which transaction kinds are valid for which asset kind, and which fields each kind requires (for example `buy` needs units and unit price; `deposit` needs only an amount).
5. **Dates helper.** `lib/dates.ts`: `todayPK()` (today in Asia/Karachi), `monthRange("2026-11")`, `addCycle(date, "monthly" | "yearly")` with correct month-end handling (31 Jan + 1 month = 28 or 29 Feb).
6. **Portfolio library.** `lib/portfolio.ts`, pure functions:
   - `computePosition(asset, txns)` → units, cost, avgCost, marketValue, unrealized, unrealizedPct, realized, income, hasPrice
   - `computeSavings(txns)` → balance, invested, income
   - `summarize(positions)` → totals per kind and overall, plus allocation shares
   - All money results rounded to 2 decimals at the return edge.
7. **Tests.** Add Vitest and a `test` script. Cover at least:
   - Two buys at different prices give the right average cost.
   - A partial sell gives the right realized gain and leaves the average cost unchanged.
   - Fees raise cost on a buy and lower proceeds on a sell.
   - Bonus units lower the average cost and leave total cost unchanged.
   - Selling everything leaves units 0 and cost 0, with no rounding dust.
   - Selling more than held throws.
   - Dividends add to income, not to cost.
   - Transactions entered out of order are processed in date order.
   - A unit asset with no price falls back to cost and reports `hasPrice: false`.
   - Savings: deposits, a withdrawal and profit give the right balance, invested and income.
   - `addCycle` month-end cases.
8. **Default categories.** Extend `scripts/create-user.ts` to insert the nine default categories for the user (skip any that already exist). Run it once for the existing account.

## Done when

- [ ] Migrations apply cleanly to an empty database and to production.
- [ ] `pnpm test` passes with all the cases above.
- [ ] The default categories exist for your account.
- [ ] `pnpm typecheck` passes with the inferred Drizzle types exported for later phases.

## Not in this phase

Routers, pages, price fetching.
