---
inclusion: always
---

# Product

finbro is a private, single-owner dashboard for a Pakistani retail investor. It tracks what the owner holds (PSX stocks, MUFAP mutual funds, money market funds, savings accounts) and what the owner spends (monthly expenses, subscriptions).

It tracks. It does not advise, predict, rank, or show other people's returns. Do not add features that do.

## Rules that shape every decision

- Money is exact. Amounts are `numeric` in Postgres and are rounded to 2 decimals at the edges. Units and NAVs keep 4 decimals.
- Every number the assistant states comes from a tool call, never from model memory.
- Every assistant write stops at an approval card. Nothing mutates data until the owner presses Approve.
- Prices come from unofficial public sources (PSX data portal, a MUFAP dataset). A source failure keeps the stored price. A manual price can always be entered.
- All business dates are plain `date` values in Asia/Karachi. No timestamps in business data.
- Sign-up is disabled. One owner account, created with `pnpm user:create`.

## Tone of the UI

Mercury-style: two surface worlds, one indigo action per view, light type (weights 360/420/480, nothing bold), tabular numerals. See `design-reference.md` and `plan/fin-bro/design.md`.
