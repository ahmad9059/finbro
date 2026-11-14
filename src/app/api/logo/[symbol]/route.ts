import { eq } from "drizzle-orm";

import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";
import { psxCompany } from "~/server/db/schema";
import { hostnameOf } from "~/server/prices/companies";
import { getIcon, iconResponse } from "~/server/prices/logo";

export const dynamic = "force-dynamic";

/**
 * The company mark, proxied and cached for a week (instance memory, Next's
 * data cache, and the browser/CDN). A 404 means "no logo", and the UI falls
 * back to a monogram.
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

  const icon = await getIcon(host);
  if (!icon) return new Response(null, { status: 404 });
  return iconResponse(icon);
}
