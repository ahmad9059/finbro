# Research

Checked on **2026-11-14**. Items are marked **Tested** (run from this machine, which is on a Pakistani IP), **Read** (taken from documentation or a registry) or **Unverified** (needs a check during the build).

## 1. T3 Stack today

| Finding | Status |
| --- | --- |
| `create-t3-app` latest is **7.40.0**, released 2025-11-05. No release since; a third-party tracker lists it as dormant. | Read (npm, GitHub releases) |
| The CLI offers Better Auth, Drizzle, tRPC, Tailwind v4, App Router, PostgreSQL. Flags exist for a non-interactive run: `--CI --tailwind --trpc --betterAuth --drizzle --dbProvider postgres --appRouter --eslint`. | Read (CLI source) |
| The scaffold pins older majors: Next `^15.2.3`, Zod `^3.24`, Drizzle `^0.41`, Better Auth `^1.3`. | Read (CLI version map) |
| Scaffold works on Node 26 / pnpm 12 (this machine). | Unverified |

**Decision:** scaffold with `create-t3-app`, then upgrade in Phase 1 while the project is empty. Upgrading an empty app takes minutes; upgrading later does not.

### Current versions (npm registry)

| Package | Latest | Package | Latest |
| --- | --- | --- | --- |
| next | 16.4.6 | tailwindcss | 4.3.5 |
| react | 19.3.1 | shadcn (CLI) | 4.23.0 |
| @trpc/server | 11.28.1 | recharts | 3.10.1 |
| @tanstack/react-query | 5.107.1 | react-hook-form | 7.92.0 |
| drizzle-orm | 0.45.4 | zod | 4.6.7 |
| drizzle-kit | 0.31.11 | next-themes | 0.4.6 |
| better-auth | 1.7.23 | lucide-react | 1.73.0 |
| date-fns | 4.4.0 | sonner | 2.0.8 |
| cheerio | 1.2.0 | vitest | 5.1.0 |

TypeScript 7.0.2 is out. The plan stays on the TypeScript version the scaffold installs; a compiler major is not worth the risk here.

### Next.js 16 note

Next 16 renames `middleware.ts` to `proxy.ts` (function `proxy`). Better Auth's docs confirm it is compatible and recommend: an optimistic cookie check in `proxy.ts`, plus a real session check in each protected layout or route. (Read: better-auth.com/docs/integrations/next)

## 2. Auth

- Better Auth `emailAndPassword: { enabled: true, disableSignUp: true }` blocks registration; the sign-up endpoint then returns `EMAIL_PASSWORD_SIGN_UP_DISABLED`. (Read: Better Auth source)
- Schema for Drizzle is generated with `npx auth@latest generate`. (Read: Better Auth CLI docs)
- Whether a server-side `auth.api.signUpEmail` call is also blocked by `disableSignUp` is **Unverified**. The plan avoids the question: the create-user script runs with an env flag that turns sign-up on for that one process.

## 3. PSX stock prices

There is **no official PSX API**. Everything public goes through the PSX data portal, `dps.psx.com.pk`.

| Source | Result from this machine |
| --- | --- |
| `GET dps.psx.com.pk/timeseries/int/{SYMBOL}` (JSON) | **Tested: HTTP 403** on every attempt, with browser headers, on both known server IPs |
| `GET dps.psx.com.pk/timeseries/eod/{SYMBOL}` (JSON) | **Tested: HTTP 403** |
| `GET dps.psx.com.pk/market-watch` | **Tested: HTTP 403** |
| `GET dps.psx.com.pk/company/{SYMBOL}` (HTML page) | **Tested: HTTP 200.** Price is in `.quote__close` (`Rs.315.87` for OGDC). Open, high, low and volume are in `.stats_label` / `.stats_value` pairs. |
| `psxterminal.com/api/ticks/REG/{SYMBOL}` | **Tested: HTTP 403** ("Access denied") |

Notes:

- Most online guides use the JSON `timeseries` endpoints. They did not work today. One library author reports that some PSX servers refuse the data routes while serving the website normally, so the JSON routes may work on other days or from other networks.
- Whether any of these work from Vercel's servers (outside Pakistan) is **Unverified**. This is the largest technical risk in the project and is tested early, in Phase 5.
- PSX's site terms reportedly prohibit automated scraping without permission and prohibit redistributing data. This project makes one request per held symbol per day, for private use. That is a low-volume personal use, but it is still unofficial, and you should know it is not a licensed feed.

**Decision:** company page first (the one that works), JSON endpoint as fallback, manual price entry always available. If a fetch fails, the old price stays and the UI shows how old it is.

### The stock directory

Searching by company name needs a list of listed companies, which the data portal
does not serve from this network (`/market-watch`, `/symbols`, `/companies` all
404 or 403).

The **Exchange's own listing page**
(`www.psx.com.pk/psx/resources-and-tools/listings/listed-companies`) carries a
`<select>` of every tradable symbol — 617 of them, including all 9 ETFs
(MIIETF, MZNPETF, NBPGETF, UBLPETF, JSGBETF, HBLTETF, NITGETF, ACIETF, JSMFETF)
and the debt instruments. That is the source of the symbol set.

Names and sectors come from the CC0 dataset "Pakistan Stock Symbols & Company
Metadata" on Hugging Face (468 equities). Symbols the dataset does not know are
named from their PSX page: `psx:sync` does this for the 9 ETFs automatically, and
for the whole tail with `--all` (a few minutes of polite requests). 567 of 617
are named; the rest are delisted or debt symbols and remain searchable by ticker.

ETFs live under `/etf/{symbol}` on the data portal, and `/company/{symbol}`
redirects there, so the existing price fetch and logo lookup work unchanged. The
JSON is committed, so search works offline and cannot break when PSX changes its
markup.

### Company logos

PSX company pages carry no logo image, but they do list the company's own
website (usually filed under ADDRESS, sometimes WEBSITE). That host is enough
to find a mark:

| Source | Result from this machine |
| --- | --- |
| `google.com/s2/favicons?domain={host}&sz=128` | 128×128 PNG/JPEG for OGDC, MCB, ENGROH, LUCK, MEEZAN; 48px for HBL; 32px for PSO; 404 for UBL |
| `icons.duckduckgo.com/ip3/{host}.ico` | Hit or miss, 16–512px |
| `https://{host}/favicon.ico`, `/apple-touch-icon.png` | Works where the site allows bots (ubldigital.com, lucky-cement.com); some sites answer 403 |

The route tries all three in order and treats Google's 16px globe as "no logo"
by reading the PNG header. Some sites only answer with a browser agent, so the
fetch sends one; Google's cache can return a 200 HTML page for a missing icon,
so nothing upstream is cached by the framework, only successfully decoded
images are kept.

Funds and savings accounts have no ticker, so their mark comes from the bank or
asset manager: `institutions.json` maps 25 AMCs and 30 banks by keyword
("ubl fund" before "ubl", "al meezan" before "meezan") to a hostname. 21 of the
25 AMCs and every major bank resolve to a real mark; the rest fall back to a
monogram. Logos are trademarks of their owners and are shown here only as
identification for a private dashboard.

### Capital Stake

`https://www.capitalstake.com` offers a REST API (`csapis.com/3.0/market/...`).
Checked 2026-11-14: every market route answers **403 `unauthorized_request`**
without a bearer token, and their site redirects `/api/...` to the marketing
page. It is usable only with an API key issued to an account, it is unofficial,
and it has no mutual-fund NAVs (MUFAP remains the source for those). Not adopted;
the price layer is isolated in `src/server/prices/`, so a `capitalstake.ts`
provider could be added later without touching the rest of the app.

## 4. Mutual fund and money market NAVs

MUFAP (the funds association) publishes NAVs daily as HTML and has no working public API. Its site is behind Cloudflare.

| Source | Result |
| --- | --- |
| `raw.githubusercontent.com/saadsalmankhan/pakistan-mutual-funds-data/main/funds.json` | **Tested: works.** 573 funds, `updatedAt` 2026-11-13T23:46Z. Fields: `fundId`, `name`, `amc`, `nav`, `offerPrice`, `category`, `shariah`. NAV here is rounded to **2 decimals**. |
| `.../main/history/{fundId}.ndjson` | **Tested: works.** One line per business day: `{"date","nav","offerPrice"}` with **4 decimals** (ABL Cash Fund: 10.6742 on 2026-11-13). |
| MUFAP directly (`mufap.com.pk/Industry/IndustryStatDaily?tab=3`) | Read only. Has NAV, offer and repurchase prices. Cloudflare may block server requests. Not used. |

Notes:

- The dataset is a personal open-source project (MIT), updated by a GitHub Action every business day around 21:30 PKT. It can stop at any time. Manual NAV entry is the fallback.
- Money market funds are mutual funds with a "Money Market" category. Same data source, same mechanics.

**Decision:** `funds.json` powers the fund picker (name, AMC, category). The last line of `history/{fundId}.ndjson` gives the 4-decimal NAV for valuation.

## 5. UI libraries

- shadcn/ui supports Tailwind v4 and themes through CSS variables (`:root` and `.dark`), including dedicated `sidebar-*` and `chart-*` tokens. This maps cleanly onto Mercury's two colour worlds. (Read: ui.shadcn.com/docs/theming)
- shadcn ships a Sidebar component (collapses to a sheet on mobile), a Chart wrapper around Recharts, Dialog, Field, Combobox, Empty and Sonner toasts. That covers every screen in this plan with no second component library.
- The `shadcn init` prompts have changed recently (component base, presets). Accept the defaults; the theme is replaced by our own tokens in Phase 2 anyway.
- Mercury's fonts (arcadia) are proprietary. The reference names **Inter variable** as the substitute; `next/font` serves it, and a variable font allows the unusual weights 360 / 420 / 480.

## 6. Hosting

- Vercel cron on the Hobby plan: at most **once per day**, fired any time within the chosen hour, UTC only, no retries. (Read: vercel.com/docs, checked by several October 2026 write-ups)
- Once a day is exactly what this project needs: stock prices after market close and fund NAVs after the evening publish.
- Vercel sends `Authorization: Bearer $CRON_SECRET` to cron routes when that env var is set. (Read; confirm when wiring in Phase 10)
- Neon free tier is assumed to be enough for a few megabytes of personal data. Current limits are **Unverified**; check the pricing page when creating the project.

## Assistant provider

**Anthropic only.** Checked live on 2026-11-17 with the project's key.

| Model | Result |
| --- | --- |
| `claude-sonnet-4-5` | Worked end to end: streaming, function calling against the account tools, the approval round-trip (approve → tool executes → confirmation), provider-native web search (`webSearch_20250305`) |
| `claude-haiku-4-5` | Answered a live request; used as the "fastest" option |
| `claude-sonnet-5`, `claude-opus-4-5` | Offered in the picker; the SDK lists models up to `claude-opus-4-8` |

**Google Gemini was evaluated and removed.** Its 2.5 models answer 404 for new
keys, `gemini-3.8-flash` returned 503 "high demand" throughout testing, and the
free tier's quota is exhausted after a handful of requests — it could not be
relied on next to a paid key. The provider abstraction and fallback code were
deleted rather than left dormant, so the assistant is one provider, one model
picker and one place for a key.

**BYOK.** A key pasted in the app is encrypted with AES-256-GCM before storage
(the cipher key is derived from `BETTER_AUTH_SECRET`), decrypted only inside the
chat route, and shown back as a masked hint. Removing it falls back to the
server key.

## Open risks

| Risk | Effect | Mitigation |
| --- | --- | --- |
| PSX blocks requests from Vercel | No automatic stock prices | Tested in Phase 5 before building on it. Fallbacks: JSON endpoint, manual price, or run the daily job from a machine in Pakistan |
| PSX changes its page markup | Price parse fails | Parser is one small file with a test fixture; failure keeps the old price and shows its age |
| Fund dataset repo stops updating | Stale NAVs | NAV age is shown; manual NAV entry |
| `create-t3-app` scaffold does not upgrade cleanly to Next 16 | Lost time in Phase 1 | Time-box the upgrade; staying on Next 15 is acceptable |
