# Phase 1 — Foundation & first deploy

**Size:** S · **Depends on:** nothing

## Goal

An empty T3 app that builds, talks to a Postgres database, and is deployed on Vercel. Deploying on day one means every later phase can be checked in production, and the PSX reachability risk can be tested from the real host in Phase 5.

## Tasks

1. **Git.** Run `git init` (the folder is not a repository yet). Keep `plan/` and `design-reference.md`.
2. **Scaffold.** Run `pnpm create t3-app@latest` and answer:
   - TypeScript · Tailwind: yes · tRPC: yes · Auth: **BetterAuth** · ORM: **Drizzle** · App Router: yes · Database: **PostgreSQL** · Linter: ESLint/Prettier · Import alias: `~/`

   Non-interactive equivalent:
   ```bash
   pnpm dlx create-t3-app@latest finbro-app --CI --tailwind --trpc --betterAuth --drizzle --dbProvider postgres --appRouter --eslint --noGit
   ```
   The project folder is not empty. If the CLI refuses to scaffold into it, scaffold into a temporary folder and move the files into the repository root.
3. **Upgrade while empty.** The scaffold pins Next 15, Zod 3, Drizzle 0.41 and Better Auth 1.3 (see research.md).
   - Next: `pnpm dlx @next/codemod@canary upgrade latest`
   - Then `pnpm up --latest` for `better-auth`, `drizzle-orm`, `drizzle-kit`, `@trpc/*`, `@tanstack/react-query`, `zod`, `@t3-oss/env-nextjs`, `tailwindcss`.
   - Leave TypeScript on the scaffold's version.
   - **Time-box this to about an hour.** If Next 16 or Zod 4 fights the scaffold, stay on the scaffold's versions and write that down in the README. It is not a blocker.
4. **Database.** Create a Neon project. Put the connection string in `.env` as `DATABASE_URL`. For local work, use either a Neon dev branch or the scaffold's `start-database.sh` (Docker).
5. **Migrations.** Use `pnpm db:generate` + `pnpm db:migrate` from the start (not `db:push`), so production changes are repeatable.
6. **Clean out the demo.** Remove the scaffold's example `post` router, table and home page content. Keep one trivial `health` query that reads from the database.
7. **Env file.** In the T3 env schema declare `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`. Remove env entries for social login providers if the scaffold added any.
8. **Scripts.** Make sure `package.json` has `dev`, `build`, `typecheck`, `lint`, `db:generate`, `db:migrate`, `db:studio`.
9. **Deploy.** Push to a private GitHub repository, import it in Vercel, set the env vars, deploy. The domain comes in Phase 10; the `*.vercel.app` URL is enough for now.
10. **README.** Short project README: how to run, how to migrate, where the plan lives.

## Done when

- [ ] `pnpm dev` serves the app locally.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm build` all pass.
- [ ] The `health` query returns a value read from Postgres, locally and on the Vercel URL.
- [ ] The versions actually installed are recorded in the README.
- [ ] No demo code from the scaffold remains.

## Not in this phase

Styling, login, any real table.
