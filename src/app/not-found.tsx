import Link from "next/link";

import { Logo } from "~/components/shared/logo";
import { Button } from "~/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-8 bg-background px-4 text-center">
      <Logo />
      <div className="flex flex-col gap-2">
        <p className="type-eyebrow text-muted-foreground">404</p>
        <h1 className="type-title">This page does not exist.</h1>
        <p className="type-body-lg text-muted-foreground">
          The link may be old, or the page may have moved.
        </p>
      </div>
      <Button asChild>
        <Link href="/">Back to Overview</Link>
      </Button>
    </main>
  );
}
