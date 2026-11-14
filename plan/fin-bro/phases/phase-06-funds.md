# Phase 6 — Mutual funds & money market

**Size:** M · **Depends on:** Phase 5

## Goal

The Mutual Funds and Money Market pages work, reusing the holdings UI from Phase 5. The new parts are the fund picker and the NAV source.

Both pages show the same kind of thing (units × NAV). They differ only in `asset.kind` and in which fund categories the picker offers.

## Tasks

1. **Funds source.** `server/prices/funds.ts`:
   - `listFunds()`: fetch `funds.json` from the dataset repository (URL in research.md), cache for 12 hours, return `fundId`, `name`, `amc`, `category`, `nav`.
   - `fetchNav(fundId)`: fetch `history/{fundId}.ndjson`, parse the **last** non-empty line for the 4-decimal NAV and its date. If that fails, fall back to the 2-decimal NAV from `funds.json`.
   - Typed errors, 10-second timeout, never throw past this file.
   - Unit-test the NDJSON parser, including a trailing blank line.
2. **`price.searchFunds({ query, moneyMarket })`:** filters the cached list by name or AMC, case-insensitive. `moneyMarket: true` keeps only categories containing "Money Market"; `false` keeps the rest. Return at most 20 results.
3. **Wire into `refreshPrices`:** assets with a `fundId` use `fetchNav`.
4. **Configure `HoldingsView`** for the two kinds:
   - Labels: "Units", "Avg NAV", "NAV" instead of shares and price.
   - Secondary line under the name: AMC and category.
   - Units and NAV shown to 4 decimals.
   - Transaction kinds: Buy (invest), Sell (redeem), Bonus (reinvested dividend), Dividend (cash payout).
5. **Add fund dialog:** a combobox that searches as you type and shows name, AMC and category. Picking a fund fills in name, AMC, `fundId` and current NAV. A "My fund is not listed" link switches to manual entry (name, AMC, NAV).
6. **Invest by amount.** In the Buy dialog, allow entering either units or the amount invested; the other is calculated from the NAV. Fund statements usually give the amount, not the units.
7. **Front-end load.** The buy dialog's fees field is labelled "Sales load / fees" on these pages.
8. **Help text.** One line in the Bonus transaction form: "Use this for dividends reinvested as extra units."

## Done when

- [ ] Searching a fund by name finds it; adding it stores the `fundId` and shows the current NAV.
- [ ] The Money Market picker lists only money market funds, and the Mutual Funds picker lists the rest.
- [ ] "Refresh prices" updates NAVs to 4 decimals, with the NAV's own date.
- [ ] Investing by amount produces the correct units.
- [ ] A reinvested dividend entered as Bonus raises units and leaves total cost unchanged.
- [ ] A fund missing from the dataset can still be added and priced by hand.
- [ ] No holdings-UI code was duplicated: both pages are `HoldingsView` with a different config.
- [ ] Both pages pass the design review checklist in both themes.

## Not in this phase

Fund return comparisons, expense ratios, benchmark charts, pension (VPS) fund handling beyond what the generic flow already supports.
