# Phase 7 — Savings accounts

**Size:** S · **Depends on:** Phase 5

## Goal

The Savings Accounts page: each account's balance, what you put in, and the profit it has earned.

Savings have no units and no market price. An account's balance is simply deposits + profit − withdrawals.

## Tasks

1. **API.** The `asset` and `assetTxn` routers already accept `kind = savings`. Make sure `asset.list({ kind: "savings" })` returns `computeSavings` results (balance, net deposited, profit earned) and that only `deposit`, `withdrawal` and `profit` transactions are accepted.
2. **Withdrawal guard.** A withdrawal that would take the balance below zero on its date is rejected with a clear message.
3. **Page** in `features/savings/`, using the shared pieces:
   - KPI cards: Total balance · Net deposited · Profit earned.
   - Accounts table: Account / bank · Profit rate · Net deposited · Profit earned · Balance.
4. **Add account dialog:** account name, bank, profit rate (% per year, optional, display only), opening balance and its date (creates the first deposit), notes.
5. **Detail sheet:** balance at the top, the transaction list, "Add transaction" as the primary button.
6. **Transaction dialog:** Deposit, Withdrawal or Profit; amount; date; notes. For Profit, a hint: "Enter the profit credited by the bank, after tax."
7. **Quick balance correction.** In the detail sheet, an "Update balance" action: you type the balance from your bank app; the app shows the difference and offers to record it as Profit (if higher) or Withdrawal (if lower). This keeps the page accurate with one entry a month.
8. **States:** skeleton, empty state ("Add your first account"), error with retry.

## Done when

- [ ] An account with an opening balance, a deposit, a withdrawal and a profit entry shows the correct balance, net deposited and profit earned.
- [ ] An overdraft withdrawal is rejected.
- [ ] "Update balance" records the right transaction for the difference.
- [ ] Savings appear in the totals returned by the portfolio `summarize` function (needed for Overview in Phase 10).
- [ ] The page passes the design review checklist in both themes.

## Not in this phase

Automatic profit calculation from the rate, term deposits with maturity dates, bank syncing.
