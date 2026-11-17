"use client";

import { usePathname } from "next/navigation";

/**
 * The app's page frame. Most screens sit in a centred 1200px column with
 * padding; the assistant is a full-bleed workspace, so it gets the whole
 * area under the top bar and manages its own scrolling.
 */
export function AppContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const fullBleed = pathname === "/assistant" || pathname.startsWith("/assistant/");

  if (fullBleed) {
    return (
      <div
        // A definite height is what lets the chat own its scrolling; the
        // arbitrary Tailwind class does not survive the build, so inline it.
        style={{ height: "calc(100vh - 4rem)" }}
        className="flex min-h-0 w-full flex-col overflow-hidden"
      >
        {children}
      </div>
    );
  }

  return (
    <div className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
      <div className="mx-auto w-full max-w-[1200px]">{children}</div>
    </div>
  );
}
