# Design: Advisor-grade assistant

## Modules (`src/server/assistant/`)

| File | Role |
| --- | --- |
| `prompt.ts` | Fixed persona and procedures (cached) plus a dynamic block: date, snapshot, health check, retrieved notes |
| `knowledge/entries.ts` | Curated notes: id, title, keywords, body, optional `verify` search hint |
| `knowledge/retrieve.ts` | BM25 over title, keywords and body, with query synonyms and a relevance floor |
| `analytics.ts` | Pure `analyzePortfolio(context)`: allocation, concentration, sectors, runway, flags |
| `validation.ts` | Pure checks: real dates, amount reconciliation, unique match, price deviation |
| `trade.ts` | Pure `evaluateTrade` (used by `simulate_trade` and `add_transaction`) and the locked loader |
| `tools.ts` | Read tools, `simulate_trade`, `portfolio_health`, `fund_search`, `search_knowledge`, and the approval-gated writes |

## Decisions

- **Retrieval is lexical (BM25), not embeddings.** The corpus is about thirty hand-written notes. Lexical search has no extra service, no index to keep in sync, runs in microseconds and is predictable. Synonyms cover CGT, WHT, NAV, MMF and Roman Urdu terms.
- **Volatile facts live outside the corpus.** Notes explain how things work and what to ask. A `verify` hint tells the model what to search for.
- **Retrieval runs twice:** automatically on the last two user messages (injected into the dynamic block) and on demand through `search_knowledge`.
- **One validation path.** `evaluateTrade` is pure, so oversell, overdraft, duplicate and price rules are unit-tested without a database. The write path wraps it in a transaction that locks the asset row (`FOR UPDATE`) and re-reads the history.
- **Approval stays unconditional.** `needsApproval` is `true` on every write. Early failure comes from `simulate_trade`, which the prompt requires before a transaction.
- **Confirmations are explicit.** Unusual price and duplicates return `needsConfirmation`; the model must ask, then re-send with `confirm`.

## Error handling

Tools return `{ ok: false, error }` for rule violations. The UI treats `ok: false` as a failure, even though the call itself completed.
