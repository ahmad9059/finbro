import { getSession } from "~/server/better-auth/server";
import { hostForInstitution } from "~/server/prices/institutions";
import { getIcon, iconResponse } from "~/server/prices/logo";

export const dynamic = "force-dynamic";

/**
 * The bank or asset manager behind a fund or savings account. The name is
 * matched against a committed map, so this route can only ever fetch from
 * institutions we know, never from an arbitrary host.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const session = await getSession();
  if (!session) return new Response(null, { status: 401 });

  const { name } = await params;
  const institution = decodeURIComponent(name).slice(0, 120);

  const host = hostForInstitution(institution);
  if (!host) return new Response(null, { status: 404 });

  const icon = await getIcon(host);
  if (!icon) return new Response(null, { status: 404 });
  return iconResponse(icon);
}
