# Phase 2 — Design system & app shell

**Size:** M · **Depends on:** Phase 1 · **Read first:** [design.md](../design.md)

## Goal

The app looks like the finished product before it does anything: Mercury tokens in light and dark mode, the sidebar and top bar from the sketch, and the shared building blocks every later page reuses. Design is the acceptance test for this whole project, so this phase gets real attention.

## Tasks

1. **shadcn/ui.** Run `pnpm dlx shadcn@latest init` and accept the defaults. Add: `sidebar button card dialog sheet input field select combobox popover calendar dropdown-menu tabs table badge tooltip skeleton sonner chart alert-dialog empty separator switch textarea`.
2. **Tokens.** Replace the generated `:root` and `.dark` blocks in `globals.css` with the ones in design.md. Register the extra tokens (`tint`, `gain`, `loss`, shadows) under `@theme inline`.
3. **Font.** Load Inter variable with `next/font/google` as `--font-sans`. Confirm in the browser that weights 360, 420 and 480 render as distinct weights.
4. **Type utilities.** Add `@utility` classes for the nine styles in design.md (`text-hero` … `text-legal`).
5. **Restyle shadcn components** to match design.md:
   - `Button`: capsule shape, 40px, variants primary / tint / ghost / icon, small size 32px. Remove the outline variant.
   - `Card`: no border; soft shadow in light, none in dark. Add a `tint` variant.
   - `Dialog` and `Sheet`: radius 16, padding 32, modal shadow, Night 60% backdrop.
   - `Input`, `Select`, `Textarea`: 40px, radius 8, indigo focus ring.
   - `Table`: eyebrow headers, 52px rows, row rules only.
6. **Theme.** `next-themes` provider (class strategy, system default) and a toggle button for the top bar. No flash of the wrong theme on load.
7. **Shell.** `(app)/layout.tsx` with:
   - Top bar: 64px, night, wordmark cell as wide as the sidebar, page title, theme toggle, user-menu placeholder.
   - Sidebar: the groups and items from the plan README, lucide icons, active row with the indigo bar. Night in both themes.
   - Below 1024px the sidebar becomes a sheet opened from the top bar.
8. **Routes.** Create every page from architecture.md as a placeholder that renders its page header and an empty state.
9. **Shared components** in `components/shared/`:
   - `PageHeader` (description + actions slot)
   - `KpiCard` (label, value, optional delta with arrow and sign)
   - `Money` (formats PKR, tabular; optional gain/loss colouring)
   - `EmptyState`, `ConfirmDialog`, `TableSkeleton`, `KpiSkeleton`
10. **Formatters** in `lib/format.ts`: `formatPKR`, `formatPercent`, `formatUnits`, `formatDate`. One place, used everywhere.
11. **Kitchen-sink page.** A temporary `/dev/ui` route showing every button variant, a KPI row, a table with fake rows, a dialog with a form, a donut and a line chart with fake data, tags, toasts and an empty state. This is where the design gets judged and tuned. Delete it in Phase 10.

## Done when

- [ ] `/dev/ui` passes the review checklist at the end of design.md, in light and dark mode.
- [ ] The sidebar and top bar are night-coloured in both themes; the active row shows the indigo bar.
- [ ] Clicking each sidebar item changes the right-hand content and highlights the item (the sketch works).
- [ ] No text on any page is heavier than weight 500.
- [ ] At 390px wide the sidebar opens as a sheet and nothing overflows.
- [ ] **You have looked at `/dev/ui` and approve the look.** If not, fix it here before building features on top.

## Not in this phase

Real data, login.
