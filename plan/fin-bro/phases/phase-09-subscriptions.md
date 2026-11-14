# Phase 9 — Subscriptions

**Size:** S · **Depends on:** Phase 8

## Goal

The Subscriptions page: services you pay for on a cycle, what they cost per month, and when each is due. A subscription sits in the list until you press **Mark paid**, which records a real expense. Nothing is logged automatically, so the expense list only ever contains payments you confirmed.

Money you give to someone is **not** a separate feature. It is an ordinary expense, entered through the add-expense popup under the "Payments to people" category.

## Tasks

### API

1. **`subscription` router:**
   - `list()`: subscriptions with their category, plus the page's KPI numbers.
   - `create`, `update`, `delete`, `setStatus` (active / paused).
   - `markPaid({ id, amount, date })`: in one database transaction, insert the expense (title = the subscription's name, its category, the amount actually paid, `subscriptionId` set), then move `nextDueDate` forward with `addCycle`. The next due date advances from the previous due date, not from the payment date, so paying late does not shift the schedule.
2. **Deleting a subscription** keeps its past expenses (the link is set to null).

### Page

3. **KPI cards:** Monthly cost (yearly plans divided by 12) · Yearly cost · Due this month.
4. **Table:** Name · Category · Cycle (tag) · Amount · Next due · action. Sorted by next due date. Overdue rows show an "Overdue" tag (icon + loss colour text). Paused items are dimmed and listed last.
5. **Add / edit dialog:** name, amount, cycle (Monthly or Yearly), next due date, category (defaults to Subscriptions), notes.
6. **Row actions:** "Mark paid" (small tint button), and a menu with Edit, Pause / Resume, Delete.
7. **Mark paid dialog:** a small confirm showing the name, with the amount and date editable (defaults: the stored amount, today). Subscription prices change; this is where you correct them. After confirming, a toast with an "Undo" action that deletes the expense and restores the previous due date.
8. **Link back.** In the Monthly Expenses table, expenses created from a subscription show a small repeat icon with a tooltip naming it.
9. **States:** skeleton, empty state ("Add your first subscription"), error with retry.

## Done when

- [ ] Marking a monthly subscription paid creates one expense in the right category and moves the due date forward exactly one month (check a 31st-of-month case).
- [ ] Undo fully reverses a Mark paid.
- [ ] A yearly subscription counts as one twelfth in "Monthly cost".
- [ ] Paused subscriptions are excluded from the KPI totals.
- [ ] Overdue subscriptions are clearly marked without relying on colour alone.
- [ ] The page passes the design review checklist in both themes.

## Not in this phase

Reminders by email or notification, automatic logging on the due date, a separate list of money owed to or by people.
