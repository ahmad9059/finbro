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
    // Public: the login page, the offline page, the PWA files and anything the
    // service worker has to cache, or it cannot install.
    "/((?!login|offline|api/|_next/static|_next/image|sw\\.js|manifest\\.webmanifest|icons/|avatar\\.jpg|icon\\.svg|.*\\.(?:svg|png|ico|webp|jpg|jpeg|webmanifest)$).*)",
  ],
};
