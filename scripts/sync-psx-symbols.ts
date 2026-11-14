/**
 * Refreshes the bundled PSX symbol directory used by the stock search.
 *
 *   pnpm psx:sync
 *
 * Two sources are merged:
 *  1. The Exchange's own listed-companies page, which carries the complete
 *     symbol list including ETFs (~620 symbols). Authoritative.
 *  2. A CC0 dataset on Hugging Face, which supplies company names and sectors.
 *     Symbols that only the Exchange knows keep their symbol as the name.
 *
 * The result is committed, so the app never needs the network to offer search.
 */
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const LISTING =
  "https://www.psx.com.pk/psx/resources-and-tools/listings/listed-companies";
const NAMES =
  "https://huggingface.co/datasets/kjhq/Pakistan-Stock-Symbols-and-Metadata/resolve/main/pakistan.csv";
const OUT = fileURLToPath(
  new URL("../src/server/prices/psx-symbols.json", import.meta.url),
);

type Row = {
  symbol: string;
  name: string;
  sector: string;
  type: "equity" | "etf";
};

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
};

/** Every symbol in the Exchange's company picker, including ETFs. */
async function fetchSymbols(): Promise<string[]> {
  const response = await fetch(LISTING, { headers: HEADERS });
  if (!response.ok) {
    throw new Error(`Listing page answered ${response.status}`);
  }
  const html = await response.text();
  const symbols = new Set<string>();
  for (const match of html.matchAll(/<option value="([A-Z0-9]{1,12})">/g)) {
    const symbol = match[1]!;
    if (symbol === "0") continue; // "Select Symbol"
    symbols.add(symbol);
  }
  return [...symbols];
}

type NameRow = { symbol: string; name: string; sector: string };

/** Company names and sectors from the CC0 dataset. Optional. */
async function fetchNames(): Promise<NameRow[]> {
  const response = await fetch(NAMES);
  if (!response.ok) throw new Error(`Name dataset answered ${response.status}`);
  const text = (await response.text()).replace(/\r/g, "");
  const [header, ...body] = text.split("\n").filter(Boolean);
  if (!header) throw new Error("The name dataset is empty.");

  const columns = header.split(",").map((column) => column.trim());
  const at = {
    name: columns.indexOf("name"),
    ticker: columns.indexOf("ticker"),
    market: columns.indexOf("market"),
    sector: columns.indexOf("sector"),
  };
  if (at.name < 0 || at.ticker < 0) {
    throw new Error("The name dataset no longer has name and ticker columns.");
  }

  const rows: NameRow[] = [];
  for (const line of body) {
    const cells = line
      .match(/("([^"]|"")*"|[^,]*)(,|$)/g)
      ?.map((cell) =>
        cell
          .replace(/,$/, "")
          .replace(/^"|"$/g, "")
          .replace(/""/g, '"')
          .trim(),
      );
    if (!cells) continue;
    if (at.market >= 0 && cells[at.market]?.toUpperCase() !== "PSX") continue;
    const symbol = cells[at.ticker]?.toUpperCase();
    const name = cells[at.name];
    if (!symbol || !name) continue;
    rows.push({ symbol, name, sector: cells[at.sector] ?? "" });
  }
  return rows;
}

/**
 * The Exchange page for one symbol, wherever it lives (equities under
 * /company, ETFs under /etf, which the company path redirects to).
 */
async function fetchCompanyName(symbol: string): Promise<string | null> {
  try {
    const response = await fetch(`https://dps.psx.com.pk/company/${symbol}`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return null;
    const html = await response.text();
    const match = /class="quote__name">([^<]+)/.exec(html);
    return match?.[1]?.trim() ?? null;
  } catch {
    return null;
  }
}

/** Fills in names the dataset does not know, a few at a time. */
async function enrich(
  rows: Row[],
  onlyEtfs: boolean,
  limit = 200,
): Promise<number> {
  const missing = rows
    .filter((row) => row.name === row.symbol && (!onlyEtfs || row.type === "etf"))
    .slice(0, limit);
  let filled = 0;

  for (let index = 0; index < missing.length; index += 4) {
    const batch = missing.slice(index, index + 4);
    await Promise.all(
      batch.map(async (row) => {
        const name = await fetchCompanyName(row.symbol);
        if (name) {
          row.name = name;
          filled += 1;
        }
      }),
    );
    if (index + 4 < missing.length) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  return filled;
}

const [symbols, names] = await Promise.all([
  fetchSymbols(),
  fetchNames().catch((error: unknown) => {
    console.warn(
      `Name dataset unavailable, symbols will stand in for names: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return [] as NameRow[];
  }),
]);

const bySymbol = new Map(names.map((row) => [row.symbol, row]));
const rows: Row[] = symbols
  .map((symbol) => {
    const known = bySymbol.get(symbol);
    const isEtf = symbol.endsWith("ETF");
    return {
      symbol,
      name: known?.name ?? symbol,
      sector: known?.sector ?? (isEtf ? "Exchange traded fund" : ""),
      type: isEtf ? ("etf" as const) : ("equity" as const),
    };
  })
  .sort((a, b) => a.symbol.localeCompare(b.symbol));

// ETFs always get their real name; `--all` fills every gap (slower).
const filled = await enrich(rows, !process.argv.includes("--all"));
if (filled > 0) console.log(`Named ${filled} symbols from the Exchange.`);

await writeFile(OUT, `${JSON.stringify(rows, null, 0)}\n`);
const named = rows.filter((row) => row.name !== row.symbol).length;
console.log(
  `Wrote ${rows.length} symbols (${rows.filter((row) => row.type === "etf").length} ETFs, ${named} with names) to ${OUT}`,
);
process.exit(0);
