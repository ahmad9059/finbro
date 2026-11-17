# Design: Portfolio invariants

## Approach

Add `fast-check` as a dev dependency and one test file, `src/lib/portfolio.property.test.ts`, next to the existing example tests. No production code changes.

## Generators

Floating-point money is the main risk, so generators produce values that are exact in two decimals:

- `units`: integers 1 to 10 000.
- `price`: cents 1 to 100 000, divided by 100.
- `fees`: cents 0 to 5 000, divided by 100.
- `amount` for buy/sell is `units × price`, as the form computes it.
- Dates: a small set of ISO dates so same-day collisions happen often.

A "valid history" generator builds buys first, then sells whose total never exceeds units held, so Requirements 1, 2 and 5 always run on legal input. A separate generator builds an illegal sell for Requirement 3.

## Tolerance

`computePosition` rounds money to 2 decimals per call, not per step, so internal drift is bounded by float error on at most a few thousand additions. Assertions use `Math.abs(a − b) <= 0.01 × n` where `n` is the number of transactions.

## Mapping

| Requirement | Property |
| --- | --- |
| 1 | `units`, `cost`, and `avgCost × units` match sums over buys |
| 2 | `cost_after + costOut = cost_before`, `realized = proceeds − costOut`, full sell gives zeros |
| 3 | an oversell throws `OVERSELL`; a legal history never throws |
| 4 | savings balance, `OVERDRAFT`, `income` |
| 5 | shuffling buys leaves the position unchanged |

## Failure handling

fast-check prints a seed and the shrunk counterexample. A failing seed is added as an explicit example test before the bug is fixed.
