import directory from "./psx-symbols.json";

export type PsxSymbol = {
  symbol: string;
  name: string;
  sector: string;
  /** Equities and ETFs share the same table; this is only for display. */
  type: "equity" | "etf";
};

/**
 * The listed-company directory, bundled at build time by `pnpm psx:sync`.
 * Search never touches the network, so the picker opens instantly.
 */
const ALL = directory as PsxSymbol[];

export const PSX_SYMBOL_COUNT = ALL.length;

export function findPsxSymbol(symbol: string): PsxSymbol | undefined {
  const wanted = symbol.trim().toUpperCase();
  return ALL.find((item) => item.symbol === wanted);
}

function score(item: PsxSymbol, query: string): number {
  const symbol = item.symbol.toLowerCase();
  const name = item.name.toLowerCase();
  const compactName = name.replace(/[^a-z0-9]/g, "");
  const compactQuery = query.replace(/[^a-z0-9]/g, "");

  if (symbol === query) return 1000;
  if (compactQuery.length > 0 && symbol === compactQuery) return 990;
  if (symbol.startsWith(compactQuery)) return 900 - symbol.length;

  const words = name.split(/[^a-z0-9]+/).filter(Boolean);
  const tokens = query.split(/\s+/).filter(Boolean);

  // "oil gas" should find "Oil & Gas Development": every token must start a word.
  if (tokens.every((token) => words.some((word) => word.startsWith(token)))) {
    return 750 - name.length / 10 + tokens.length;
  }
  if (compactQuery.length > 2 && compactName.includes(compactQuery)) {
    return 600 - name.length / 10;
  }
  if (name.includes(query)) return 500 - name.length / 10;
  if (item.sector.toLowerCase().includes(query)) return 200;
  return 0;
}

/** Ranked matches for a typed query: symbol first, then company name. */
export function searchPsxSymbols(query: string, limit = 20): PsxSymbol[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return [];

  return ALL.map((item) => ({ item, score: score(item, needle) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.item.symbol.localeCompare(b.item.symbol))
    .slice(0, limit)
    .map((entry) => entry.item);
}
