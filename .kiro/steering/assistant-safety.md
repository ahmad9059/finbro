---
inclusion: fileMatch
fileMatchPattern: ["src/server/assistant/**/*.ts", "src/features/assistant/**/*.tsx", "src/server/api/routers/assistant.ts", "src/server/api/routers/chat.ts"]
---

# Assistant safety rules

- Read tools return data. Every write tool sets `needsApproval: true`, which renders an approval card, and the mutation runs only after the owner approves. A new write tool without `needsApproval: true` is a bug.
- Numbers in an answer come from a tool result. Do not let the prompt invite the model to estimate.
- A stored Anthropic key is encrypted with AES-256-GCM (`crypto.ts`) and is only ever shown masked. Never log a key, never return it from a router, never put one in a test fixture except an obviously fake one.
- Errors reach the user as one sentence plus Retry. No stack traces in the UI.
- `ASSISTANT_MOCK` is development only and must stay ignored in production.

## Adding or changing a write tool

A write tool is not done until it has all of these:

1. `needsApproval: true`, and an entry in `WRITE_TOOLS` and in `TOOL_META`/`describeInput` (`tool-call.tsx`) so the card shows every field.
2. Strict target resolution with `pickMatch`: never choose between two matches.
3. Dates through `checkDate` (real, not in the future unless a due date). Money through `round`.
4. A duplicate guard that returns `needsConfirmation`, and a `confirm` input for the owner's explicit override.
5. Multi-row changes inside `db.transaction`, with the parent row locked (`.for("update")`) when the rule reads the history.
6. Return `{ ok: false, error }` for a refusal, never throw for a rule violation.
7. Pure rules in `trade.ts`/`validation.ts` with unit tests. A prompt change needs a prompt test.

## Knowledge notes

Notes in `src/server/assistant/knowledge/entries.ts` explain concepts and what to check. They never state a tax rate, policy rate, yield, index level or fee schedule; put a `verify` search hint instead. The test suite rejects stray percentages. Do not use finbro command words ("expense", "subscription") as keywords, or plain commands start retrieving advice.

