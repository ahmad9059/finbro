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
