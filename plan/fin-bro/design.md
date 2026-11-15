# Design

The brand source is [design-reference.md](../../design-reference.md) (Mercury). That reference describes a **marketing site**. This document adapts it to a **data dashboard**, in light and dark mode. Where the two disagree, the reference wins on colour, type and shape; this document wins on density and layout.

## The idea in three lines

- **Calm and tonal.** Surfaces separate by fill colour, not borders or shadows.
- **One loud thing per screen.** A single indigo pill carries the main action. Everything else is a translucent pill.
- **Light type, big numbers.** Nothing above weight 500. Hierarchy comes from size and colour.

## Two worlds

| | Light mode ("day") | Dark mode ("night") |
| --- | --- | --- |
| Page | Canvas `#fbfcfd` | Night `#171721` |
| Text | Ink `#28253b` | On Dark `#ededf3` |
| Secondary text | Ink Secondary `#554e7b` | Fog `#c3c3cc` |
| Data panels (tables, charts) | Surface `#ffffff` + soft shadow | Night Raised `#1e1e2a`, no shadow |
| Summary cards (KPIs) | Lavender `#edecfb` | Night Raised `#1e1e2a` |
| Sidebar and top bar | Surface `#ffffff` + 1px rule, ink text | Night `#171721`, on-dark text |

The shell follows the theme. Mercury brackets its marketing pages in dark, but inside a working dashboard a permanently dark rail next to a white page reads as a bug, so the rail is white in the day and night at night. The Mercury signature survives in the fill-not-border surfaces, the single indigo action and the light type.

Active navigation is the same in both worlds: a lavender (light) or night-raised (dark) row with a 3px indigo bar on the left edge.

The app opens in **dark mode** by default, with a toggle in the top bar (`next-themes`, class strategy). Light and System are one click away in the toggle and in Settings.

## Colour tokens

Paste-ready for `globals.css`. Names follow shadcn so every component picks them up. Values marked *derived* are not in the reference; they were added because a dashboard needs them, and they stay inside the same hue family.

```css
:root {
  --radius: 0.75rem;                          /* rounded.md, 12px */

  --background: #fbfcfd;                      /* canvas */
  --foreground: #28253b;                      /* ink */
  --card: #ffffff;                            /* surface */
  --card-foreground: #28253b;
  --tint: #edecfb;                            /* lavender: KPI cards */
  --tint-foreground: #28253b;
  --popover: #ffffff;
  --popover-foreground: #28253b;

  --primary: #5266eb;                         /* Mercury Indigo */
  --primary-foreground: #ffffff;
  --secondary: rgb(82 102 235 / 0.10);        /* button-tint-light */
  --secondary-foreground: #28253b;
  --muted: #f4f4fb;                           /* hover and skeleton fill, derived */
  --muted-foreground: #554e7b;                /* ink-secondary */
  --accent: rgb(82 102 235 / 0.08);           /* hover fill, derived */
  --accent-foreground: #28253b;

  --border: rgb(195 195 204 / 0.60);          /* fog rule */
  --input: rgb(85 78 123 / 0.22);             /* button-outline-light border */
  --ring: #5266eb;

  --gain: #17794e;                            /* derived, data only */
  --loss: #c0364a;                            /* derived, data only */
  --destructive: #c0364a;

  --chart-1: #5266eb;                         /* indigo */
  --chart-2: #8b7cf0;                         /* violet, derived */
  --chart-3: #554e7b;                         /* ink-secondary */
  --chart-4: #9cb4e8;                         /* periwinkle */
  --chart-5: #28253b;                         /* ink */

  --sidebar: #171721;                         /* night, in both modes */
  --sidebar-foreground: #ededf3;
  --sidebar-muted-foreground: #c3c3cc;        /* fog */
  --sidebar-accent: #1e1e2a;                  /* night-raised: hover and active row */
  --sidebar-accent-foreground: #ededf3;
  --sidebar-primary: #5266eb;                 /* active indicator */
  --sidebar-primary-foreground: #ffffff;
  --sidebar-border: rgb(112 112 125 / 0.30);  /* slate */
  --sidebar-ring: #5266eb;

  --shadow-soft: 0 1px 2px rgb(40 37 59 / 0.04), 0 6px 16px rgb(40 37 59 / 0.05);
  --shadow-modal: 0 2px 4px rgb(40 37 59 / 0.05), 0 16px 40px rgb(40 37 59 / 0.09);
}

.dark {
  --background: #171721;                      /* night */
  --foreground: #ededf3;                      /* on-dark */
  --card: #1e1e2a;                            /* night-raised */
  --card-foreground: #ededf3;
  --tint: #1e1e2a;
  --tint-foreground: #ededf3;
  --popover: #262635;                         /* one more step up, derived */
  --popover-foreground: #ededf3;

  --primary: #5266eb;
  --primary-foreground: #ffffff;
  --secondary: rgb(156 180 232 / 0.20);       /* button-tint-dark, periwinkle */
  --secondary-foreground: #ededf3;
  --muted: #1e1e2a;
  --muted-foreground: #c3c3cc;                /* fog */
  --accent: rgb(195 195 204 / 0.12);          /* hover fill, derived */
  --accent-foreground: #ededf3;

  --border: rgb(112 112 125 / 0.40);          /* slate rule */
  --input: rgb(112 112 125 / 0.60);
  --ring: #5266eb;

  --gain: #5fcf9f;
  --loss: #f08a97;
  --destructive: #f08a97;

  --chart-1: #5266eb;
  --chart-2: #9cb4e8;
  --chart-3: #8b7cf0;
  --chart-4: #c3c3cc;
  --chart-5: #ededf3;

  --shadow-soft: none;                        /* depth is tonal at night */
  --shadow-modal: 0 16px 40px rgb(0 0 0 / 0.35);
}
```

Expose the extra tokens to Tailwind under `@theme inline`: `--color-tint`, `--color-tint-foreground`, `--color-gain`, `--color-loss`, `--color-sidebar-muted-foreground`, `--shadow-soft`, `--shadow-modal`.

### Measured contrast (WCAG ratio)

| Pair | Ratio | Use |
| --- | --- | --- |
| Ink on Canvas | 14.4 | Body text, light |
| Ink Secondary on Canvas / on Lavender | 7.4 / 6.5 | Secondary text, light |
| On Dark on Night | 15.3 | Body text, dark |
| Fog on Night / on Night Raised | 10.2 / 9.4 | Secondary text, dark |
| White on Indigo | 4.7 | Primary button label |
| Gain / Loss on white | 5.4 / 5.4 | P&L numbers, light |
| Gain / Loss on Lavender | 4.6 / 4.7 | P&L numbers on KPI cards |
| Gain / Loss on Night Raised | 8.6 / 6.9 | P&L numbers, dark |
| Indigo on Night | 3.8 | **Not for text.** Fills and indicators only |
| Slate on Night | 3.6 | **Not for text.** Rules only |
| Periwinkle on white | 2.1 | **Chart slot 4 only**, always with a label |

### Colour rules

- Indigo is for the one main action, the active sidebar indicator, focus rings and chart series 1. In dark mode, links and accent text use Periwinkle `#9cb4e8` (8.6 on Night), never Indigo.
- Green and red exist **only on data**: P&L numbers, deltas, an "Overdue" tag. Never on buttons, borders, backgrounds or navigation. This follows the reference: status colours "belong to product mockups, not the interface". The dashboard *is* the product, so they appear on its numbers and nowhere else.
- Gain and loss are never shown by colour alone: always a sign (`+` / `−`) and an arrow icon.
- Never put Ink on night surfaces or On Dark on the light canvas.

## Typography

**Inter variable** through `next/font/google`, exposed as `--font-sans`. Mercury's arcadia is proprietary; the reference names Inter as the closest match.

| Style | Size / line | Weight | Tracking | Use |
| --- | --- | --- | --- | --- |
| `type-hero` | 42 / 1.15 | 480 | 0.42px | Net worth on Overview only |
| `type-title` | 28 / 1.2 | 480 | 0.42px | Page title, KPI numbers |
| `type-lead` | 24 / 1.2 | 480 | 0.48px | Dialog titles, the amount field |
| `type-body-lg` | 18 / 1.35 | 360 | 0 | Empty-state copy, intro lines |
| `type-body` | 16 / 1.4 | 400 | 0 | Default text |
| `type-ui` | 16 / 1 | 420 | 0 | Buttons, inputs, sidebar items |
| `type-ui-sm` | 14 / 1.4 | 420 | 0.07px | Table cells, small pills, field labels |
| `type-eyebrow` | 12 / 1 | 500 | 0.28px, uppercase | KPI labels, table headers, sidebar group labels |
| `type-legal` | 12 / 1.4 | 400 | 0.24px | "As of" stamps, hints |

Define each as a Tailwind `@utility` in `globals.css` so they are used by name. They are prefixed `type-`, not `text-`: the class merger treats any unknown `text-*` class as a colour and drops it when a text colour is also present.

Rules:

- No weight above 500, anywhere. No `font-bold`, no `font-semibold`.
- Every number in a table or KPI uses `tabular-nums` so columns line up.
- Uppercase only for eyebrows.
- The reference's 52px and 60px marketing sizes are not used; 42px is the ceiling in an app.

## Spacing, shape, depth

- **Spacing** on the 8px base: 8, 12, 16, 20, 24, 32, 40. Page gutter 32 (16 on mobile). Gap between cards 16. Gap between page sections 32. The reference's 80 and 128 section gaps are for marketing pages and are not used.
- **Radius**: cards and panels 12. Dialogs and sheets 16. Inputs and selects 8. Tags and checkboxes 4. All buttons are full capsules.
- **Depth**: light-mode data panels and popovers get `--shadow-soft`; dialogs get `--shadow-modal`. Nothing else has a shadow. Dark mode has no shadows except under dialogs.
- **Borders**: only 1px row rules inside tables and lists, and input outlines. Cards have no border.

## Components

### Buttons

| Variant | Look | Use |
| --- | --- | --- |
| Primary | Indigo fill, white label, capsule, 40px tall, 20px side padding | The one main action on a view: "Add expense", "Add transaction", "Sign in", "Save" |
| Tint (`secondary`) | 10% indigo (light) or 20% periwinkle (dark), text-coloured label | Every other action: "Refresh prices", "Cancel", "Mark paid", "Edit" |
| Ghost | No fill until hover (`--accent`) | Icon buttons, row menus |
| Small | 32px tall, 16px padding, `type-ui-sm` | Buttons inside table rows and cards |
| Icon | Round, 40px (32px small) | Theme toggle, close, row menu |

Never two primary buttons in one view. Inside a dialog, "Save" is primary and the page's own primary button is behind the overlay, which is fine. No outlined buttons, no square corners. Destructive actions are a tint button with a `--loss` label, behind a confirm dialog.

### App shell

```
┌────────────┬──────────────────────────────────────────────────────┐
│ ◆ finbro   │  PSX Stocks                         ☾   ⟳   (A)      │  top bar, 64px, night
├────────────┼──────────────────────────────────────────────────────┤
│ Overview   │                                                      │
│            │   page content on canvas (light) or night (dark)     │
│ INVESTMENTS│   max width 1200, gutter 32                          │
│ ▍PSX Stocks│                                                      │
│  Mutual…   │                                                      │
│  Money…    │                                                      │
│  Savings   │                                                      │
│            │                                                      │
│ EXPENSES   │                                                      │
│  Monthly…  │                                                      │
│  Subscr…   │                                                      │
│            │                                                      │
│ Settings   │                                                      │
└────────────┴──────────────────────────────────────────────────────┘
  248px
```

- **Top bar**: 64px (the reference's nav is 72px; trimmed for an app). Left cell holds the wordmark and is the same width as the sidebar. Right side: page title in On Dark, then theme toggle, user menu.
- **Sidebar row**: 40px tall, 8px radius, icon 18px + `type-ui` label. Default text secondary. Hover: lavender fill (light) or Night Raised (dark). **Active: the same fill, primary text, and a 3px indigo bar on the left edge.**
- **Group labels**: `type-eyebrow` in secondary text.
- **Below 1024px**: the sidebar becomes an off-canvas sheet opened from a menu button in the top bar.

### Page header

Sits on the canvas, under the top bar: a one-line description in secondary text on the left (the title itself is in the top bar), and on the right the tint actions followed by the single primary button.

### KPI card (Mercury's `stat-block`)

Lavender fill (light) or Night Raised (dark). Radius 12, padding 24, no border, no shadow.

```
MARKET VALUE                 ← type-eyebrow, secondary colour
Rs 1,284,500                 ← type-title, tabular
▲ +Rs 84,500 (+7.0%)         ← type-ui-sm, gain or loss colour, with arrow and sign
```

Four in a row on desktop, two on tablet, one on mobile.

### Data table (`ex-data-table-cell`)

- Lives in a panel: Surface + soft shadow (light), Night Raised (dark), radius 12.
- Header: `type-eyebrow`, secondary colour, no fill, 44px tall.
- Rows: 52px tall, `type-ui-sm`, 1px rule between rows, no zebra stripes, no vertical lines.
- Numbers right-aligned with `tabular-nums`. First column: name in primary text with a small secondary line under it (symbol, AMC or bank).
- Row hover: `--accent` fill. A clickable row opens the detail sheet.
- Narrow screens: the panel scrolls sideways and the first column stays pinned.

### Detail sheet

Slides in from the right, 480px wide (full width on mobile), radius 16 on the left corners. Shows one holding: its numbers at the top, then the transaction list, then a primary "Add transaction" button. This is the "details of that item" area from the sketch, one level deeper.

### Dialog (`ex-modal-card`) — the add/edit popup

- Popover-coloured surface, radius 16, padding 32, max width 480, `--shadow-modal`. Backdrop: Night at 60%.
- Title in `type-lead`. Fields stacked with 16px gaps.
- Footer right-aligned: tint "Cancel", then primary "Save".
- **Add expense** is the showcase: the amount field comes first, set large in `type-lead` with a fixed `Rs` prefix, focused on open. Then date (defaults to today), category, title, notes. Enter submits. After saving, a toast confirms and the dialog closes.

### Form fields

40px tall, radius 8, 1px `--input` outline, Surface fill (light) or Night (dark). Label above in `type-ui-sm`, secondary colour. Focus: 2px indigo ring. Error: the message below in `--loss` with an icon; the outline changes too, so the error is not colour-only.

The reference's fused email-capture field is a marketing pattern and is not used.

The PSX company field is a searchable combobox over the bundled directory: type a symbol (`ogdc`) or part of a name (`oil gas`) and pick from a ranked list showing symbol, company and sector. Arrow keys and Enter work. ETFs are in the same list and carry a small `ETF` tag beside their sector, as do ETF rows in the holdings table. Picking fills the company and price; the price request is cached for five minutes on the server. A found symbol fills the name and price and shows a green confirmation line; an unknown one clears them and explains why. There is no "Look up" button to press.

### Charts

MUI X Charts (`@mui/x-charts`), wrapped in a small `ChartTheme` bridge that maps the Mercury tokens onto a minimal MUI theme, so axis labels, grid and tooltips inherit the same colours as the rest of the app. MUI's reset is not used.

- One colour per asset kind, held constant across both themes: PSX Stocks indigo, Mutual Funds periwinkle, Money Market violet, Savings neutral. The same four colours drive the donut, the stacked area and the legends.
- Axis labels `type-legal` in secondary text, horizontal grid only (`3 3` dash), no vertical axis line, no chart border.
- Tooltips: popover surface, 8px radius, modal shadow; amounts in PKR.
- Legends are built in HTML beside the chart rather than in the chart, so they can show name, value and share.
- **Allocation donut**: MUI pie, inner radius 62, 2px gaps, hover fades the other arcs, total in the centre, and a legend listing name, value and percent beside it. The legend is the accessible version of the chart.
- **Net-worth line**: one indigo line, soft area fill, no dots until hover, five x-axis labels regardless of range.
- **Spending by category**: CSS bars in a single colour (indigo), sorted largest first, each labelled with name and amount. Not a nine-colour pie.
- **Value by kind**: stacked area of the daily snapshots, one band per asset kind, with a value legend underneath.
- **By holding**: horizontal bars of the largest eight positions, symbol or name on the axis.
- **Six-month spending trend**: vertical bars, the current month in indigo and earlier months in the tint colour.
- Axis labels in `type-legal`, secondary colour. Grid lines use `--border`, horizontal only. Tooltips use the popover surface.

### Company logos

Holdings show the company mark beside the name: a 32px (40px in the detail sheet, 28px in lists) white disc with a hairline ring, the mark inset 15%. Logos are fetched through `/api/logo/{symbol}` for stocks and `/api/logo/institution/{name}` for the bank or asset manager behind a fund or savings account — a committed map of 25 AMCs and 30 banks decides the host, so no arbitrary domain is ever fetched. Both are cached for a week; until one arrives — or when an institution has none — a tinted monogram with its initials sits underneath, so a row never shows an empty ring.

### Icons

lucide, 1.5px stroke. Every navigation item, page title, KPI card label, section title and empty state carries one; buttons carry one when the action has an obvious mark (plus, pencil, trash, refresh, check). Icons are decorative and `aria-hidden` unless they are the only label, in which case the control gets an `aria-label`.

### Privacy mode

An eye in the top bar — and at the right edge of the Overview banner, beside the number it protects — masks every amount in the app with `••••••`. It is one switch for every route:

- Money, deltas, percentages, units, average costs, rates and fees are masked; counts ("3 holdings", "11 expenses") and dates stay readable.
- Charts are replaced by a small panel explaining that the chart is hidden, with a "Show amounts" button. A chart's shape is numbers too.
- Public market prices (a stock's price, a fund's NAV) stay visible: they are not yours. Everything derived from your position — units, cost, value, P&L — is hidden.
- Titles, categories and notes stay readable, so the page remains navigable.
- The choice is remembered per browser in `localStorage` and follows the account across tabs.

### Micro-interactions

Motion is feedback, never decoration. Only things you can act on move; a card that cannot be clicked has no hover state.

- **Timing tokens** in `globals.css`: `--motion-fast` 120ms, `--motion-base` 180ms, `--motion-slow` 240ms, with `--ease-out` (`cubic-bezier(0.16, 1, 0.3, 1)`) for things arriving and `--ease-press` for the press itself. Nothing on a click response runs longer than 240ms.
- **Buttons**: the solid action darkens slightly, lifts 1px and gains a soft indigo shadow (light mode only); secondary pills deepen their tint and lift 1px; icon buttons only fill. Every button presses to 97% and settles at 180ms. No bounce.
- **Navigation**: the active bar is a single element that springs from item to item (Motion `layoutId`, 520/42), and the row icon nudges 2px on hover. Rows themselves use a 200ms fill.
- **Tables and lists**: 150ms row fill, and row actions fade in on hover or keyboard focus, staying visible on touch screens where hover does not exist.
- **Inputs and switches**: borders and rings ease in over 200ms; the switch knob travels over 200ms rather than snapping.
- **Charts**: hover highlights the item and fades its siblings, with a tooltip; no entrance animation on page load.
- **Dialogs and sheets**: shadcn's fade and zoom, Escape closes, focus is trapped.
- **Toasts**: bottom right, popover surface, 4s, with an Undo action where a write can be reversed.
- Everything above is disabled under `prefers-reduced-motion`, including the spring on the navigation bar, which becomes an instant swap.

### Small pieces

- **Tag**: 4px radius, `type-legal`, tint fill. For category, cycle ("Monthly"), price age. "Overdue" uses the `--loss` text colour with an icon.
- **Empty state** (`ex-empty-state-card`): a tint panel, a 40px line icon, one `type-body-lg` sentence, and the page's primary action.
- **Loading**: skeleton blocks in the shape of the real content. No spinners on page load.
- **Toast** (`ex-toast`): Sonner, bottom right, popover surface, radius 12.
- **Icons**: lucide, 1.5px stroke, 18px in navigation and buttons.

### Login page (`ex-auth-form-card`)

A centred card on the canvas, radius 12, padding 32, 400px wide, soft shadow: wordmark, "Sign in" in `type-title`, email and password fields, one full-width primary button. No sign-up link, no social buttons. Follows the theme like every other screen.

## Page layouts

Every page under the shell uses the same order: **page header → KPI row → main panel → secondary panels**.

| Page | KPI row | Main panel | Primary action |
| --- | --- | --- | --- |
| Overview | Net worth (hero size), Unrealized gain, Spent this month, Due in 30 days | Allocation donut + net-worth line, side by side | none |
| PSX Stocks | Market value, Invested, Unrealized P&L, Realized + dividends | Holdings table → detail sheet | Add holding |
| Mutual Funds / Money Market | Same four | Holdings table → detail sheet | Add fund |
| Savings Accounts | Total balance, Net deposited, Profit earned | Accounts table → detail sheet | Add account |
| Monthly Expenses | Spent this month, vs last month, Biggest category | Month switcher + expenses table; category bars and six-month trend beside or below | Add expense |
| Subscriptions | Monthly cost, Yearly cost, Due this month | Subscriptions table with "Mark paid" | Add subscription |
| Settings | none | Categories, password, theme | none |

Overview also shows two short lists under the charts: upcoming payments and top holdings.

## Motion

150–200ms ease-out for hover fills, dialogs, sheets and the theme change. No entrance animations on page content. Everything is disabled under `prefers-reduced-motion`.

## Accessibility

- Visible 2px focus ring on every interactive element.
- Hit areas at least 40px; 44px on touch screens.
- Every input has a label; every icon-only button has an accessible name.
- Dialogs and sheets trap focus and close on Escape (shadcn provides this; do not break it).
- Meaning is never carried by colour alone (see gain/loss, errors, charts).

## Do and don't

| Do | Don't |
| --- | --- |
| One indigo button per view | Two solid indigo buttons side by side |
| Translucent capsule for every other action | Outlined or square buttons |
| Separate surfaces by fill | Borders around cards, heavy shadows |
| Weights 360–500 | Bold or semibold text |
| A shell that matches the mode | A night rail on a light page |
| Green/red on numbers only, with sign and arrow | Green/red buttons, backgrounds or borders |
| Skeletons and designed empty states | Blank panels, bare spinners |

## Review checklist (run on every screen)

1. Light mode and dark mode both look intentional.
2. Exactly one primary button.
3. No text heavier than 500; numbers are tabular and right-aligned.
4. No card borders; shadows only where this document allows them.
5. Loading, empty and error states exist.
6. Works at 390px wide.
7. Keyboard: Tab order is sensible, focus is visible, Escape closes overlays.
