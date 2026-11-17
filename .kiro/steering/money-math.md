---
inclusion: fileMatch
fileMatchPattern: ["src/lib/portfolio.ts", "src/lib/portfolio.test.ts", "src/server/api/routers/asset-txn.ts", "src/server/jobs/**/*.ts"]
---

# Money maths

`src/lib/portfolio.ts` is the single source of truth for positions. Pure functions: no database, no "now", no I/O.

- Unit assets use the average-cost method. A sell removes `cost / units * qty` from cost and books `amount - fees - costOut` as realized gain.
- Buy cost includes fees. Bonus units add units at zero cost. Dividends are income, not cost.
- Savings: balance = deposits + profit - withdrawals. A withdrawal above the balance throws `OVERDRAFT`. A sell above units held throws `OVERSELL`.
- Transactions are replayed in date order, then by id, so back-dated entries must stay valid on every later date.

When you change this file:

1. Update or add an example test in `portfolio.test.ts`.
2. Check the invariants in `.kiro/specs/portfolio-invariants/requirements.md` still hold. The property tests in `src/lib/portfolio.property.test.ts` encode them.
3. Run `pnpm test`.
