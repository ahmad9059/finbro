/**
 * Refreshes the bundled PSX symbol directory used by the stock search.
 *
 *   pnpm psx:sync
 *
 * Source: the CC0 "Pakistan Stock Symbols & Company Metadata" dataset on
 * Hugging Face, updated weekly by its author. The result is committed, so the
 * app never needs the network to offer search.
 */
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const SOURCE =
  "https://huggingface.co/datasets/kjhq/Pakistan-Stock-Symbols-and-Metadata/resolve/main/pakistan.csv";
const OUT = fileURLToPath(
  new URL("../src/server/prices/psx-symbols.json", import.meta.url),
);

type Row = { symbol: string; name: string; sector: string };

/** Minimal CSV parse: the file has no quoted commas in practice, but be safe. */
function parseCsv(text: string): Row[] {
  const lines = text.replace(/\r/g, "").split("\n").filter(Boolean);
  const [header, ...body] = lines;
  if (!header) throw new Error("The dataset is empty.");
  const columns = header.split(",").map((column) => column.trim());
  const index = (name: string) => columns.indexOf(name);

  const at = {
    name: index("name"),
    ticker: index("ticker"),
    market: index("market"),
    sector: index("sector"),
  };
  if (at.name < 0 || at.ticker < 0) {
    throw new Error("The dataset no longer has name and ticker columns.");
  }

  const rows: Row[] = [];
  for (const line of body) {
    // Names can contain commas inside quotes; handle the simple quoted case.
    const cells = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g)?.map((cell) =>
      cell.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"').trim(),
    );
    if (!cells) continue;
    if (at.market >= 0 && cells[at.market]?.toUpperCase() !== "PSX") continue;
    const symbol = cells[at.ticker]?.toUpperCase();
    const name = cells[at.name];
    if (!symbol || !name) continue;
    if (!/^[A-Z0-9]{1,12}$/.test(symbol)) continue;
    rows.push({ symbol, name, sector: cells[at.sector] ?? "" });
  }
  return rows;
}

const response = await fetch(SOURCE);
if (!response.ok) {
  console.error(`Could not download the dataset: ${response.status}`);
  process.exit(1);
}

const rows = parseCsv(await response.text());
const unique = [...new Map(rows.map((row) => [row.symbol, row])).values()].sort(
  (a, b) => a.symbol.localeCompare(b.symbol),
);

await writeFile(OUT, `${JSON.stringify(unique, null, 0)}\n`);
console.log(`Wrote ${unique.length} symbols to ${OUT}`);
process.exit(0);
