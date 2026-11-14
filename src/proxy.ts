import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic redirect for pages only (API routes guard themselves): this checks that a session cookie exists, not that
 * it is valid. The real check is in app/(app)/layout.tsx and in every tRPC
 * procedure.
 */
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!login|api/|_next/static|_next/image|icon.svg|.*\\.(?:svg|png|ico|webp)$).*)",
  ],
};
