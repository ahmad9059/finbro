import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "~/components/shared/logo";
import { Button } from "~/components/ui/button";

export const metadata: Metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-8 px-6 text-center">
      <Logo />
      <div className="flex flex-col gap-2">
        <p className="type-eyebrow text-muted-foreground">Offline</p>
        <h1 className="type-title">No connection right now.</h1>
        <p className="max-w-sm type-body text-muted-foreground">
          finbro needs the network to load fresh prices. Your last screen stays
          available; try again when you are back online.
        </p>
      </div>
      <Button asChild>
        <Link href="/">Try again</Link>
      </Button>
    </main>
  );
}
