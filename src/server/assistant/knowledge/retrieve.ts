import { KNOWLEDGE, type KnowledgeEntry } from "./entries";

/**
 * Lexical retrieval (BM25) over a small, hand-written corpus. No embeddings, no
 * extra service, no index to keep in sync, and the behaviour is predictable.
 * Titles and keywords count three times as much as the body.
 */

const STOPWORDS = new Set([
  "the",
  "an",
  "of",
  "to",
  "in",
  "on",
  "for",
  "and",
  "or",
  "is",
  "are",
  "was",
  "do",
  "does",
  "did",
  "my",
  "me",
  "it",
  "its",
  "what",
  "how",
  "should",
  "can",
  "could",
  "would",
  "with",
  "about",
  "at",
  "be",
  "this",
  "that",
  "from",
  "by",
  "as",
  "if",
  "vs",
  "you",
  "your",
  "we",
  "add",
  "rs",
  "pkr",
  "please",
  "tell",
  "give",
  "show",
  "get",
  "much",
  "many",
  "any",
  "some",
  "have",
  "has",
  "had",
  "will",
  "just",
  "now",
  "than",
  "then",
  "there",
  "their",
  "they",
  // Command words in finbro itself; they say nothing about which note is relevant.
  "expense",
  "expenses",
  "subscription",
  "subscriptions",
]);

/** Query-side expansions so shorthand finds the full term. */
const SYNONYMS: Record<string, string[]> = {
  cgt: ["capital", "gains", "tax"],
  wht: ["withholding", "tax"],
  nav: ["net", "asset", "value"],
  mmf: ["money", "market", "fund"],
  fbr: ["tax", "filer"],
  rda: ["roshan", "digital"],
  sbp: ["state", "bank", "policy", "rate"],
  tbill: ["treasury", "bill"],
  invest: ["investing", "allocation"],
  profit: ["gain", "return"],
  pension: ["retirement"],
  salary: ["income", "budget"],
  save: ["savings"],
  loss: ["losing"],
  stocks: ["stock", "shares"],
  share: ["shares", "stock"],
};

function stem(token: string): string {
  if (token.length > 4 && token.endsWith("ies"))
    return `${token.slice(0, -3)}y`;
  if (token.length > 4 && token.endsWith("ing")) return token.slice(0, -3);
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss"))
    return token.slice(0, -1);
  return token;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter(
      (token) =>
        token.length > 1 && !/^\d+$/.test(token) && !STOPWORDS.has(token),
    )
    .map(stem)
    .filter((token) => !STOPWORDS.has(token));
}

type Indexed = {
  entry: KnowledgeEntry;
  length: number;
  frequency: Map<string, number>;
  /** Terms found in the title or keywords. */
  strong: Set<string>;
};

function buildIndex(entries: readonly KnowledgeEntry[]): Indexed[] {
  return entries.map((entry) => {
    const frequency = new Map<string, number>();
    const strong = new Set<string>();
    const bump = (token: string, weight: number) =>
      frequency.set(token, (frequency.get(token) ?? 0) + weight);

    for (const token of tokenize(entry.title)) {
      bump(token, 3);
      strong.add(token);
    }
    for (const token of tokenize(entry.keywords.join(" "))) {
      bump(token, 3);
      strong.add(token);
    }
    for (const token of tokenize(entry.body)) bump(token, 1);

    const length = [...frequency.values()].reduce(
      (sum, value) => sum + value,
      0,
    );
    return { entry, length, frequency, strong };
  });
}

const INDEX = buildIndex(KNOWLEDGE);
const AVG_LENGTH =
  INDEX.reduce((sum, doc) => sum + doc.length, 0) / INDEX.length;
const K1 = 1.4;
const B = 0.75;

const documentFrequency = new Map<string, number>();
for (const doc of INDEX) {
  for (const token of doc.frequency.keys()) {
    documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
  }
}
const idf = (token: string) => {
  const n = documentFrequency.get(token) ?? 0;
  return Math.log(1 + (INDEX.length - n + 0.5) / (n + 0.5));
};

/** Below this a hit is noise (chit-chat, or a stray word in one body). */
const MIN_SCORE = 3;
/** Keep results within this fraction of the best score. */
const RELATIVE_CUTOFF = 0.45;

export type Retrieved = { entry: KnowledgeEntry; score: number };

export function retrieveKnowledge(
  query: string,
  options: { limit?: number } = {},
): Retrieved[] {
  const limit = options.limit ?? 4;
  const base = tokenize(query);
  const terms = new Set<string>(base);
  for (const token of base) {
    for (const extra of SYNONYMS[token] ?? []) terms.add(stem(extra));
  }
  if (terms.size === 0) return [];

  const scored: (Retrieved & { matched: number; strongHit: boolean })[] = [];
  for (const doc of INDEX) {
    let score = 0;
    let matched = 0;
    let strongHit = false;
    for (const term of terms) {
      const tf = doc.frequency.get(term);
      if (!tf) continue;
      matched += 1;
      if (doc.strong.has(term)) strongHit = true;
      const norm = tf + K1 * (1 - B + (B * doc.length) / AVG_LENGTH);
      score += idf(term) * ((tf * (K1 + 1)) / norm);
    }
    // Stray body words are not evidence. Need a title/keyword hit or three terms.
    if (score >= MIN_SCORE && (strongHit || matched >= 3)) {
      scored.push({ entry: doc.entry, score, matched, strongHit });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0]?.score ?? 0;
  return scored
    .filter((row) => row.score >= best * RELATIVE_CUTOFF)
    .slice(0, limit)
    .map(({ entry, score }) => ({
      entry,
      score: Math.round(score * 100) / 100,
    }));
}

/** Notes as text for the prompt or a tool result. */
export function renderNotes(results: readonly Retrieved[]): string[] {
  return results.map(({ entry }) => {
    const verify = entry.verify
      ? ` (Figures change: confirm with web search, e.g. "${entry.verify}")`
      : "";
    return `- ${entry.title}: ${entry.body}${verify}`;
  });
}
