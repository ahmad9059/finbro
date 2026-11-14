/** Icon fetching shared by the stock and institution logo routes. */

const MAX_BYTES = 400_000;
const ONE_WEEK_SECONDS = 60 * 60 * 24 * 7;
export const ONE_WEEK = ONE_WEEK_SECONDS;

export type Icon = { body: ArrayBuffer; type: string };

/** Hosts already fetched in this instance, so repeat views never leave it. */
const memory = new Map<string, Icon>();
/** Hosts with no icon, so a missing logo is not retried on every page view. */
const misses = new Map<string, number>();
const MISS_TTL_MS = 2 * 60 * 1000;

/** Width of a PNG, read from the IHDR chunk. Null for anything else. */
function pngWidth(bytes: Uint8Array): number | null {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!signature.every((value, index) => bytes[index] === value)) return null;
  if (bytes.length < 24) return null;
  return (
    (bytes[16]! << 24) | (bytes[17]! << 16) | (bytes[18]! << 8) | bytes[19]!
  );
}

async function download(url: string, minimumWidth: number): Promise<Icon | null> {
  try {
    const response = await fetch(url, {
      // Some sites reject requests without a browser-like agent.
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/png,image/*;q=0.8,*/*;q=0.5",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;

    const type = response.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) return null;

    const body = await response.arrayBuffer();
    if (body.byteLength === 0 || body.byteLength > MAX_BYTES) return null;

    // Google answers with a 16px globe when it has no icon for the domain.
    const width = pngWidth(new Uint8Array(body));
    if (width !== null && width < minimumWidth) return null;

    return { body, type };
  } catch {
    return null;
  }
}

/**
 * Tries three sources in order of quality: Google's favicon cache, then
 * DuckDuckGo's, then the site's own icons. Returns null when none has one.
 */
async function resolveIcon(host: string): Promise<Icon | null> {
  const sources: [string, number][] = [
    [`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`, 24],
    [`https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`, 1],
    [`https://${host}/apple-touch-icon.png`, 24],
    [`https://${host}/favicon.ico`, 1],
  ];
  for (const [url, minimumWidth] of sources) {
    const icon = await download(url, minimumWidth);
    if (icon) return icon;
  }
  return null;
}

/** The icon for a host, from memory, then upstream sources. */
export async function getIcon(host: string): Promise<Icon | null> {
  const cached = memory.get(host);
  if (cached) return cached;

  const missedAt = misses.get(host);
  if (missedAt && Date.now() - missedAt < MISS_TTL_MS) return null;

  const icon = await resolveIcon(host);
  if (icon) {
    if (memory.size > 400) memory.clear();
    memory.set(host, icon);
    misses.delete(host);
    return icon;
  }
  misses.set(host, Date.now());
  return null;
}

/** A response that caches the icon for a week in the browser and at the edge. */
export function iconResponse(icon: Icon) {
  return new Response(icon.body, {
    headers: {
      "content-type": icon.type,
      "cache-control": `public, max-age=${ONE_WEEK_SECONDS}, immutable`,
    },
  });
}
