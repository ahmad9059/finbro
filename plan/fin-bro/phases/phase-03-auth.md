# Phase 3 — Auth

**Size:** S · **Depends on:** Phases 1–2

## Goal

Only you can open the dashboard. One account, created from the command line. No sign-up page exists.

## Tasks

1. **Better Auth config.** Email + password only. Remove any social provider the scaffold added.
   ```ts
   emailAndPassword: {
     enabled: true,
     disableSignUp: env.AUTH_ALLOW_SIGNUP !== "true",
   }
   ```
   Add `AUTH_ALLOW_SIGNUP` (optional) to the env schema. Add the `nextCookies()` plugin last in the plugin list.
2. **Auth tables.** Generate the Drizzle schema with `npx auth@latest generate`, then `pnpm db:generate` and `pnpm db:migrate`.
3. **Create-user script.** `scripts/create-user.ts` reads email, name and password from arguments or prompts, and creates the user through Better Auth. Run it as:
   ```bash
   AUTH_ALLOW_SIGNUP=true pnpm tsx scripts/create-user.ts
   ```
   Running it again for an existing email reports that clearly instead of failing with a stack trace.
4. **Login page.** `(auth)/login/page.tsx`, built to the "Login page" spec in design.md: night background, centred card, email, password, one primary button. Wrong credentials show one generic message ("Email or password is incorrect"). The button shows a pending state while signing in.
5. **Protection, three layers:**
   - `src/proxy.ts`: if there is no session cookie, redirect to `/login`. Match everything except `/login`, `/api/auth`, `/api/cron` and static files. (On Next 15 this file is `middleware.ts`.)
   - `(app)/layout.tsx`: validate the session on the server with `auth.api.getSession`; redirect to `/login` if it is missing.
   - tRPC: every router uses `protectedProcedure`; `ctx.session.user.id` is the `userId` for all queries.
6. **Signed-in redirect.** Visiting `/login` with a valid session goes to `/`.
7. **User menu.** In the top bar: your name and email, "Settings", "Sign out".
8. **Change password.** A small form on the Settings page using Better Auth's change-password call (current password, new password).
9. **Rate limiting.** Enable Better Auth's rate limiter for sign-in. On Vercel, memory is not shared between function instances, so use the database storage option. Confirm the exact option name in the Better Auth docs while implementing.
10. **Search engines.** Set `robots: { index: false, follow: false }` in the root metadata.

## Done when

- [ ] Opening any app URL while signed out lands on `/login`.
- [ ] Signing in with the created account lands on Overview; signing out returns to `/login`.
- [ ] A direct request to the sign-up endpoint is rejected.
- [ ] A tRPC call without a session returns `UNAUTHORIZED`.
- [ ] Repeated wrong passwords get rate limited.
- [ ] The login page matches design.md in both themes (it is night-coloured in both).
- [ ] The account exists in the production database and login works on the Vercel URL.

## Not in this phase

Password reset by email (re-run the script instead), two-factor auth, social login.
