# Tasks: Portfolio invariants

- [x] 1. Add `fast-check` as a dev dependency
- [x] 2. Write generators for exact-cent money and valid histories in `src/lib/portfolio.property.test.ts`
- [x] 3. Property: buy-only histories add up (Requirement 1)
- [x] 4. Property: partial and full sells conserve cost (Requirement 2)
- [x] 5. Property: oversell throws `OVERSELL`, legal histories never throw (Requirement 3)
- [x] 6. Property: savings ledger and `OVERDRAFT` (Requirement 4)
- [x] 7. Property: permuting buys does not change the position (Requirement 5)
- [x] 8. Run `pnpm test` and `pnpm check`
