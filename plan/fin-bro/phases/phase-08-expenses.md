# Phase 8 — Monthly expenses

**Size:** M · **Depends on:** Phase 4 (UI pieces from Phase 2)

## Goal

Adding an expense takes a few seconds through a popup, and the Monthly Expenses page shows where the month's money went.

## Tasks

### API

1. **`category` router:** `list`, `create`, `rename`, `delete`. Deleting a category that has expenses or subscriptions is refused with a message naming how many use it.
2. **`expense` router:**
   - `list({ month })`: the month's expenses, newest first, with category.
   - `summary({ month })`: total, previous month's total, the difference, and totals per category sorted largest first.
   - `trend()`: totals for the last six months.
   - `create`, `update`, `delete`.

### The add-expense popup

3. **`ExpenseDialog`** built to the spec in design.md:
   - **Amount** first, large, with a fixed `Rs` prefix, focused when the dialog opens.
   - **Date**, defaulting to today (Pakistan date).
   - **Category** select, remembering the last one used.
   - **Title** (what it was).
   - **Notes**, optional.
   - Enter submits; Escape closes. "Save" is the primary button; "Save and add another" is a tint button that keeps the dialog open with date and category preserved.
   - The same dialog edits an existing expense.
   - A toast confirms the save; the list and KPIs update without a page reload.
4. **Open from anywhere.** The "Add expense" primary button on the Monthly Expenses page, plus the keyboard shortcut `E` anywhere in the app (ignored while typing in a field).

### The page

5. **Month switcher** in the page header: previous / next arrows and the month name; the next arrow is disabled on the current month. The month lives in the URL (`?month=2026-11`) so reload and back/forward work.
6. **KPI cards:** Spent this month · vs last month (difference, with arrow and sign; *more* spending is shown in the loss colour) · Biggest category.
7. **Expenses table:** Date · Title · Category (tag) · Amount. Row menu with Edit and Delete (with confirm). A category filter above the table.
8. **Spending by category:** horizontal bars, sorted, labelled with name, amount and share.
9. **Six-month trend:** bar chart, current month highlighted. Clicking a bar switches to that month.
10. **States:** skeletons; empty month ("Nothing spent in November yet" + Add expense); error with retry.

### Settings

11. **Categories section** on the Settings page: list, add, rename, delete (with the in-use rule above).

## Done when

- [ ] From a closed dialog, an expense can be added with: `E`, type amount, Tab, type title, Enter.
- [ ] The new expense appears at once, and the KPIs and both charts update.
- [ ] Switching months changes the URL and the data; reloading keeps the month.
- [ ] Totals per category add up to the month total.
- [ ] A category in use cannot be deleted.
- [ ] The page and the dialog pass the design review checklist in both themes and at 390px.

## Not in this phase

Budgets, receipt photos, recurring expenses (Phase 9), CSV import or export, income tracking.
