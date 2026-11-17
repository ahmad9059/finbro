# Kiroween 2026 submission notes

Working notes for the Devpost form. Delete this file before you want the repo to look final; nothing in the app depends on it. Anything in `[brackets]` is yours to fill in, because it depends on how you actually used Kiro.

## Category

Frankenstein.

## Text description (draft)

finbro is a quiet dashboard for a Pakistani retail investor. It tracks PSX stocks, MUFAP mutual funds and money market funds, and savings accounts, plus monthly spending and subscriptions, and stops there: no advice, no predictions.

The Frankenstein part is what it stitches together. Prices come from two sources that were never meant to be an API: the PSX data portal (scraped HTML with a JSON fallback) and a community MUFAP dataset on GitHub. They feed an exact-decimal ledger where positions are derived, never stored. On top sits a tool-calling Claude assistant with read access to the whole account and web search, and every change it proposes stops at an approval card. The whole thing installs as a PWA.

## What to show in the 3-minute video

1. Overview with the privacy eye toggled (0:00 to 0:25).
2. Add a PSX holding by searching a company name, record a buy, see average-cost P&L (0:25 to 1:00).
3. Ask the assistant for net worth, then "add 2,500 for groceries" and press Approve on the card (1:00 to 1:50).
4. Mark a subscription paid, then Undo (1:50 to 2:15).
5. Open the repo: `.kiro/` steering, hooks, the spec, and `pnpm test` running the property tests (2:15 to 2:50).

Record on the device the app is meant for (desktop browser, or the installed PWA on your phone). Use the demo account, with no real balances on screen.

## How Kiro was used (facts from the repo)

- **Steering:** five files in `.kiro/steering/`. Three always-on (product, tech, structure) and two that load only on matching files (`money-math.md`, `assistant-safety.md`). The strategy: keep the always-on set short and put hard rules (approval gating, exact money, no `.env` writes) next to the files they protect.
- **Hooks:** four in `.kiro/hooks/`. Tests on `src/lib` saves, an agent checklist on `schema.ts` saves, a `PreToolUse` guard that blocks writes to `.env`, and a `Stop` hook that typechecks and asks for another turn on failure.
- **Spec:** `.kiro/specs/portfolio-invariants/` (requirements, design, tasks) for the property-based tests.
- **Property-based testing:** `src/lib/portfolio.property.test.ts`, fast-check. Quick check of value: removing `+ txn.fees` from the buy cost in `computePosition` fails the property tests and one example test.

## Still yours to write

- Your own estimate: about 80 to 90 percent of the build was done with Kiro. Say which parts (for example the API routers, the assistant, the UI) and which you did by hand, so the number is checkable.
- [Which Kiro surfaces you used (IDE, CLI, Web, Crew) and how they differed.]
- [Whether you used custom agents, MCP servers or powers, and what they changed. Leave out any you did not use.]
- [Spec-driven versus vibe coding in your own experience on this project.]
- [Any bug the property tests caught that example tests missed. None so far: the suite passed on its first run.]

## Bonus prizes you can still go for

- **Social Blitz:** post with `#KiroweenHackathon26` as the first words, add the URL.
- **Bonus Blog:** publish a post on a third-party platform that says it was written for the Kiroween 2026 hackathon, add the URL.
- **Best Demo:** no extra steps.
- **Ghost of Kiroween Past:** only if you registered for Kiroween 2025. The project itself must be new, which it is (first commit 2026-11-14).

## Submission checklist

- [ ] Repo is public on GitHub, with `LICENSE` showing in the About box.
- [ ] `.kiro/` is committed and not in any `.gitignore`.
- [ ] Deployed URL works. Sign-up is disabled, so create the judge account with `pnpm user:create` and `pnpm seed:demo <email>`, then put the email and password in the Devpost form (private field), not in the repo.
- [ ] `BETTER_AUTH_URL` matches the deployed domain.
- [ ] Judges' account has an Anthropic key stored (Settings → Assistant) or `ANTHROPIC_API_KEY` set on the server, so the assistant answers.
- [ ] Demo video: public on YouTube, under 3 minutes, no copyrighted music.
- [ ] Submit before Friday 2026-12-04, 2:00 PM Pacific (Saturday 2026-12-05, 2:00 AM in Pakistan).
