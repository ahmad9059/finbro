# Phase 5 — PSX stocks

**Size:** L · **Depends on:** Phase 4

## Goal

The PSX Stocks page works end to end: add a holding, record buys, sells, bonus shares and dividends, see value and profit, refresh prices. This is the largest phase because it builds the holdings UI and the price pipeline that Phases 6 and 7 reuse.

## Tasks

### First: test the risk

1. **PSX fetcher.** `server/prices/psx.ts`:
   - `fetchPrice(symbol)`: GET `https://dps.psx.com.pk/company/{SYMBOL}` with a normal browser User-Agent and a 10-second timeout; read `.quote__close` with cheerio; strip `Rs.` and commas. Also return the company name from the page.
   - On failure, try `https://dps.psx.com.pk/timeseries/int/{SYMBOL}` (JSON, newest row first, price at index 1) with the header `X-Requested-With: XMLHttpRequest`.
   - Return `{ price, name, asOf }` or a typed error. Never throw past this file.
   - Save one real company page as a test fixture and unit-test the parser against it.
2. **Check it from Vercel.** Deploy a temporary protected procedure that calls `fetchPrice("OGDC")` and run it on the Vercel URL.
   - **Works:** continue.
   - **Blocked:** stop and decide before going further. Options, in order of effort: (a) accept manual stock prices; (b) run the daily job from a machine in Pakistan that calls the same code; (c) move hosting to a VPS (architecture.md, "Hosting"). Record the decision in research.md.

### API

3. **`asset` router:** `list({ kind })` returns assets with computed positions and the totals for the KPI row; `get`, `create`, `update`, `delete` (deleting removes the asset's transactions too).
4. **`assetTxn` router:** `list({ assetId })`, `create`, `update`, `delete`. Every write re-validates the full transaction history with the portfolio library, so a change that would make holdings negative is rejected with a clear message.
5. **`price` router:** `lookupStock({ symbol })`, `refresh({ kind })`, `setManual({ assetId, price, date })`.
6. **`server/prices/refresh.ts`:** the `refreshPrices` function from architecture.md. One request at a time, a short pause between requests, skip assets refreshed in the last 10 minutes, collect failures.

### UI (built generically in `features/investments/`, configured per asset kind)

7. **`HoldingsView`:** page header, four KPI cards (Market value, Invested, Unrealized P&L, Realized + dividends), holdings table.
   - Columns: Name / symbol · Shares · Avg cost · Price · Value · P&L · P&L %.
   - Sortable by value and P&L. Sold-out holdings are hidden behind a "Show closed" switch.
   - A price older than 3 days shows an "as of {date}" tag; a holding with no price shows "No price".
8. **Add holding dialog:** symbol field → on blur call `lookupStock` → fill in the company name and price, or show "Symbol not found; you can still add it and set the price by hand". Optional broker and notes. Optionally enter the first buy in the same dialog (shares, price, date, fees).
9. **Detail sheet:** opens on row click. Position numbers at the top, the transaction list below (date, kind, shares, price, amount, fees), edit and delete per row, "Add transaction" as the primary button.
10. **Transaction dialog:** kind selector (Buy, Sell, Bonus, Dividend); the fields change with the kind; amount is calculated live from shares × price; date defaults to today.
11. **Edit holding:** name, broker, notes, and "Set price manually".
12. **Refresh prices button** (tint) in the page header: pending state while running; toast with the result ("7 updated, 1 failed: XYZ").
13. **States:** skeletons while loading, an empty state with "Add your first holding", an error panel with retry.

## Done when

- [ ] The PSX fetch result from Vercel is recorded, and a decision is written down if it was blocked.
- [ ] Adding a holding by symbol fills in the name and current price.
- [ ] After two buys and a partial sell, the page shows the same numbers as a hand calculation.
- [ ] A sell larger than the holding is rejected with a readable message.
- [ ] "Refresh prices" updates prices and reports failures without breaking the page.
- [ ] A manual price can be set and shows its source and date.
- [ ] `HoldingsView` takes its columns, labels and transaction kinds from a config object, ready for Phase 6.
- [ ] The page passes the design review checklist in both themes.

## Not in this phase

Price history charts per stock, sector breakdowns, the KSE-100 index, CSV import.
