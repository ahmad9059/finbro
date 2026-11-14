import { db } from "~/server/db";
import { psxCompany } from "~/server/db/schema";

import type { PriceQuote } from "./types";

/** Stores the company facts we learn from a PSX page, for the logo route. */
export async function rememberCompany(symbol: string, quote: PriceQuote) {
  if (!quote.name && !quote.website) return;
  await db
    .insert(psxCompany)
    .values({
      symbol: symbol.toUpperCase(),
      name: quote.name ?? null,
      website: quote.website ?? null,
    })
    .onConflictDoUpdate({
      target: psxCompany.symbol,
      set: {
        name: quote.name ?? null,
        website: quote.website ?? null,
        updatedAt: new Date(),
      },
    });
}

/** Hostname only: "http://www.ubl.com.pk/about" → "www.ubl.com.pk". */
export function hostnameOf(website: string | null | undefined): string | null {
  if (!website) return null;
  try {
    const url = new URL(website.includes("://") ? website : `https://${website}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.hostname;
  } catch {
    return null;
  }
}
