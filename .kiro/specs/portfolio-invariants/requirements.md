# Requirements: Portfolio invariants

## Introduction

`computePosition` in `src/lib/portfolio.ts` turns a list of transactions into units, cost, average cost, realized and unrealized gain, and savings balance. Every number on the Overview, the holdings pages and the assistant's answers comes from it. Example-based tests cover known cases. This spec adds property-based tests so the rules hold for any valid transaction history, not only the ones someone thought of.

## Requirements

### Requirement 1: Buy-only histories add up

**User story:** As an investor, I want my units and cost to equal what I bought, so that the dashboard matches my broker statement.

#### Acceptance criteria

1. WHEN a stock has only buy transactions, THEN `units` SHALL equal the sum of bought units.
2. WHEN a stock has only buy transactions, THEN `cost` SHALL equal the sum of `amount + fees`, to within 0.01 per transaction.
3. WHEN units are held, THEN `avgCost × units` SHALL equal `cost`, to within rounding of the 4-decimal average.

### Requirement 2: Selling conserves cost

**User story:** As an investor, I want realized gain to be exactly what I received minus the cost of what I sold, so that no money appears or disappears.

#### Acceptance criteria

1. WHEN units are partly sold, THEN remaining `cost` plus the cost removed by the sale SHALL equal the total bought cost.
2. WHEN a sale has no fees, THEN `realized` SHALL equal `proceeds − cost removed`.
3. WHEN the whole position is sold, THEN `units` and `cost` SHALL both be 0.

### Requirement 3: Overselling is always rejected

**User story:** As an investor, I want a sell larger than my holding to be refused, so that I cannot record an impossible history.

#### Acceptance criteria

1. WHEN a sell quantity exceeds the units held on that date, THEN `computePosition` SHALL throw `PortfolioError` with code `OVERSELL`.
2. WHEN no sell exceeds the units held on its date, THEN `computePosition` SHALL NOT throw.

### Requirement 4: Savings balance follows the ledger

**User story:** As a saver, I want my balance to be deposits plus profit minus withdrawals, so that it matches my bank app.

#### Acceptance criteria

1. WHEN every withdrawal is covered by the balance at that point, THEN `marketValue` SHALL equal deposits + profit − withdrawals, to within 0.01.
2. WHEN a withdrawal exceeds the balance at that point, THEN `computePosition` SHALL throw `PortfolioError` with code `OVERDRAFT`.
3. `income` SHALL equal the sum of profit credits.

### Requirement 5: Order of same-day entries does not matter for totals

**User story:** As an investor, I want to enter buys in any order on the same day without changing my totals.

#### Acceptance criteria

1. WHEN only buy transactions are permuted, THEN the resulting position SHALL be identical.

## Out of scope

Fees on sells beyond the no-fee conservation check, tax lots, multi-currency, and any change to how positions are computed.
