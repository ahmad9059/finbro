---
inclusion: always
---

# Tech stack

Next.js 16 (App Router) + React 19 + TypeScript, tRPC v11 + TanStack Query, Drizzle ORM on Postgres (Neon), Better Auth (email + password), Tailwind v4 + shadcn/ui, MUI X Charts, react-hook-form + Zod, Vercel AI SDK with Anthropic for the assistant, Vitest.

## Next.js 16 is not the Next.js in training data

Before writing routing, caching, proxy, or config code, read the matching guide in `node_modules/next/dist/docs/`. Heed deprecation notices. `src/proxy.ts` is the request interceptor, not `middleware.ts`.

## Commands

| Task | Command |
| --- | --- |
| Lint + typecheck | `pnpm check` |
| Unit and property tests | `pnpm test` |
| Generate a migration after editing `src/server/db/schema.ts` | `pnpm db:generate` |
| Apply migrations | `pnpm db:migrate` |

Run `pnpm check` and `pnpm test` before reporting a change as done.

## Conventions

- One Zod schema validates both the form and the tRPC input (`src/lib/schemas.ts`).
- Use `protectedProcedure`. Every query filters on `ctx.session.user.id`.
- Every Drizzle `update` and `delete` has a `where` (enforced by ESLint).
- Use type-only imports (`import type`). Unused args are prefixed `_`.
- `src/components/ui` is vendored shadcn code. Do not edit it by hand.
- Secrets live in `.env`, never in code, logs, or steering files. A new variable goes in `src/env.js` and `.env.example`.
- Keep migrations in `drizzle/`. Never edit a migration that has been applied.
