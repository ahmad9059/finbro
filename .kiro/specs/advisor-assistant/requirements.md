# Requirements: Advisor-grade assistant

## Introduction

The assistant answers questions about the owner's account. This spec makes it a Pakistan-market advisor (analysis and recommendations, never guarantees) and makes every change it writes to the account safe: validated, atomic, de-duplicated and reversible.

## Requirements

### Requirement 1: Pakistan-market expertise without stale numbers

**User story:** As an investor in Pakistan, I want advice that reflects local instruments, tax and market structure, so that the guidance fits my situation.

1. WHEN a question touches Pakistani markets, tax, funds or saving, THEN the system SHALL retrieve the most relevant curated notes and give them to the model.
2. The system SHALL NOT hard-code tax rates, policy rates, yields or index levels. IF an answer needs one, THEN the model SHALL confirm it by web search and name the source and date.
3. WHEN the user writes in Roman Urdu, THEN the retrieval SHALL still find the right notes and the reply SHALL follow the user's language.

### Requirement 2: Advice grounded in the account

**User story:** As an owner, I want a review that points at real problems in my portfolio, so that I know what to do first.

1. The system SHALL compute concentration (single stock, sector), emergency-fund runway, idle cash, stale prices, large losers and subscription burn in code, not in the model.
2. WHEN advice is requested, THEN the answer SHALL give an action, an amount, an order and one trade-off, and SHALL NOT give price targets, timing calls or guaranteed returns.
3. WHEN the portfolio has no flagged issue, THEN the assistant SHALL say so and not invent one.

### Requirement 3: Writes are validated before and after approval

**User story:** As an owner, I want the assistant never to record something wrong, so that my numbers stay true.

1. WHEN a name matches more than one holding or subscription, THEN the system SHALL refuse to choose and SHALL list the candidates.
2. WHEN a date is not a real calendar date or is in the future, THEN the write SHALL be rejected.
3. WHEN units × price and the amount disagree beyond rounding, THEN the write SHALL be rejected.
4. WHEN a price is more than 40% away from the last known price, or an identical entry already exists, THEN the write SHALL be rejected unless the owner has explicitly confirmed it.
5. WHEN a transaction would oversell or overdraw at any point in the history, THEN it SHALL be rejected.
6. `simulate_trade` and `add_transaction` SHALL use the same validation function.
7. A holding and its opening transaction SHALL be created in one database transaction.
8. Every write SHALL still require the owner's approval.

### Requirement 4: Mistakes can be fixed

1. The assistant SHALL be able to delete a transaction (only if the remaining history stays valid), update an expense, and update or pause a subscription, each behind approval.
2. WHEN a write fails after approval, THEN the approval card SHALL show the reason and not a success mark.

### Requirement 5: Cost and latency

1. The fixed part of the system prompt SHALL be sent as a cacheable block, separate from the account snapshot.
