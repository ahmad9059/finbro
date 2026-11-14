import { eq } from "drizzle-orm";

import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";
import { psxCompany } from "~/server/db/schema";
import { hostnameOf } from "~/server/prices/companies";

export const dynamic = "force-dynamic";

const MAX_BYTES = 400_000;
const ONE_WEEK = 60 * 60 * 24 * 7;

/** Icons already fetched in this instance, so repeat views never leave it. */
const memory = new Map<string, { body: ArrayBuffer; type: string }>();

/** Width of a PNG, read from the IHDR chunk. Null for anything else. */
function pngWidth(bytes: Uint8Array): number | null {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!signature.every((value, index) => bytes[index] === value)) return null;
  if (bytes.length < 24) return null;
  return (
    (bytes[16]! << 24) | (bytes[17]! << 16) | (bytes[18]! << 8) | bytes[19]!
  );
}

type Icon = { body: ArrayBuffer; type: string };

async function download(url: string, minimumWidth: number): Promise<Icon | null> {
  try {
    const response = await fetch(url, {
      // Cached in the framework's data cache for a week: one upstream fetch
      // per company per week, shared by every visitor.
      cache: "force-cache",
      next: { revalidate: ONE_WEEK },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) return null;

    const type = response.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) return null;

    const body = await response.arrayBuffer();
    if (body.byteLength === 0 || body.byteLength > MAX_BYTES) return null;

    // Clearing houses answer with a 16px globe when they have no icon.
    const width = pngWidth(new Uint8Array(body));
    if (width !== null && width < minimumWidth) return null;

    return { body, type };
  } catch {
    return null;
  }
}

/**
 * Tries the three sources in order of quality: Google's favicon cache, then
 * DuckDuckGo's, then the site's own icon. Returns null when none has one.
 */
async function resolveIcon(host: string): Promise<Icon | null> {
  const sources: [string, number][] = [
    [`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`, 24],
    [`https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`, 24],
    [`https://${host}/apple-touch-icon.png`, 24],
    [`https://${host}/favicon.ico`, 1],
  ];
  for (const [url, minimumWidth] of sources) {
    const icon = await download(url, minimumWidth);
    if (icon) return icon;
  }
  return null;
}

/**
 * The company mark, proxied and cached for a week in three layers: this
 * instance's memory, Next's data cache and the browser/CDN. A 404 means "no
 * logo", and the UI falls back to a monogram.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const session = await getSession();
  if (!session) return new Response(null, { status: 401 });

  const { symbol } = await params;
  const wanted = decodeURIComponent(symbol).toUpperCase();
  if (!/^[A-Z0-9]{1,12}$/.test(wanted)) {
    return new Response(null, { status: 400 });
  }

  const [company] = await db
    .select({ website: psxCompany.website })
    .from(psxCompany)
    .where(eq(psxCompany.symbol, wanted))
    .limit(1);

  const host = hostnameOf(company?.website);
  if (!host) return new Response(null, { status: 404 });

  const cached = memory.get(wanted);
  const icon = cached ?? (await resolveIcon(host));
  if (!icon) return new Response(null, { status: 404 });
  if (!cached) {
    if (memory.size > 400) memory.clear();
    memory.set(wanted, icon);
  }

  return new Response(icon.body, {
    headers: {
      "content-type": icon.type,
      "cache-control": `public, max-age=${ONE_WEEK}, immutable`,
    },
  });
}
