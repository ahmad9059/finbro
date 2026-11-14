# finbro

Personal investment and expense tracker for `fin.devshub.xyz`. PSX stocks, mutual
funds, money market funds, savings accounts, monthly expenses and subscriptions —
in one dashboard, dark by default with a light theme one click away.

The plan this was built from lives in [`plan/fin-bro/`](plan/fin-bro/README.md).

## Stack

Next.js 16 (App Router) · TypeScript · tRPC · Drizzle ORM · PostgreSQL (Neon) ·
Better Auth · Tailwind CSS v4 · shadcn/ui · Recharts.

## Running it

```bash
pnpm install
cp .env.example .env      # then fill in the values
pnpm db:migrate
pnpm dev
```

Open http://localhost:3000 and sign in. There is no sign-up page: accounts are
created from the command line.

| Command | What it does |
| --- | --- |
| `pnpm dev` | Development server |
| `pnpm build` | Production build |
| `pnpm typecheck` | TypeScript, no emit |
| `pnpm lint` | ESLint |
| `pnpm test` | Unit tests for the money maths and date helpers |
| `pnpm check` | Lint + typecheck |
| `pnpm db:generate` | Write a migration from `src/server/db/schema.ts` |
| `pnpm db:migrate` | Apply migrations |
| `pnpm db:studio` | Browse the database |
| `pnpm user:create` | Create the owner account |
| `pnpm seed:demo <email>` | Fill an account with demo data (wipes its data first) |
| `pnpm user:delete <email>` | Delete an account and everything it owns |
| `pnpm rate-limit:clear` | Reset Better Auth's sign-in counters |

## Environment

| Name | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon pooled connection string |
| `BETTER_AUTH_SECRET` | Session signing secret (`openssl rand -base64 32`) |
| `BETTER_AUTH_URL` | `http://localhost:3000` or `https://fin.devshub.xyz` |
| `CRON_SECRET` | Guards `/api/cron/daily`; Vercel sends it automatically |
| `AUTH_ALLOW_SIGNUP` | `true` only while `pnpm user:create` runs |

## Creating the account

```bash
pnpm user:create
```

Sign-up is disabled for every other path, so this is the only way in. Running it
again with an existing email changes nothing.

## Prices

- **Stocks** come from the PSX data portal (`dps.psx.com.pk`). It has no official
  API; the app reads the company page and falls back to the JSON tick endpoint.
  If PSX cannot be reached the stored price stays and is marked stale.
- **Fund and money market NAVs** come from the open MUFAP dataset on GitHub
  (`saadsalmankhan/pakistan-mutual-funds-data`), updated each business evening.
- Any price can be entered by hand from the holding's sheet. Manual prices show
  their date and are replaced by the next successful automatic refresh.

Neither source is a licensed feed; both are used for private, low-volume
personal tracking and can change without notice.

## The daily job

`GET /api/cron/daily` refreshes prices, writes one net-worth snapshot per asset
kind, and returns a summary. It requires `Authorization: Bearer $CRON_SECRET`.

`vercel.json` schedules it at `0 18 * * *` UTC — late evening in Pakistan, after
the PSX close and the fund dataset update. On Vercel's Hobby plan it fires
somewhere within that hour. Running it twice is safe.

To run it by hand:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://fin.devshub.xyz/api/cron/daily
```

## Deploying

1. Push the repository to GitHub.
2. In Vercel, import it and add the environment variables above
   (`BETTER_AUTH_URL=https://fin.devshub.xyz`).
3. Add `fin.devshub.xyz` as a domain and create the DNS record Vercel shows.
4. Run the migrations once against the production database:
   `pnpm db:migrate` with the production `DATABASE_URL`.
5. Create your account: `pnpm user:create`.
6. Check that the sign-up endpoint is refused (it should answer
   `EMAIL_PASSWORD_SIGN_UP_DISABLED`) and that `/api/cron/daily` returns 401
   without the secret.

## Before you deploy

The local database has a demo account, `dev-tester@finbro.local`, with seeded
data. It uses a known password, so remove it before the app is public:

```bash
pnpm user:delete dev-tester@finbro.local
```

## Backups

```bash
pg_dump "$DATABASE_URL" > finbro-$(date +%F).sql
```

Neon keeps point-in-time history for a limited window; take a dump now and then
as well.

## Layout

```
src/app/            routes: (app) shell pages, (auth) login, api/auth, api/cron
src/components/     ui (shadcn, themed), shell (sidebar, top bar), shared
src/features/       investments, savings, expenses, subscriptions, overview, settings
src/lib/            portfolio maths, dates, formatting, schemas, categories
src/server/         db, better-auth, tRPC routers, price sources, daily job
scripts/            create-user, seed-demo, clear-rate-limit
```
