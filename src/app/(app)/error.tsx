"use client";

import { CircleAlert } from "lucide-react";
import { useEffect } from "react";

import { Button } from "~/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-5 rounded-lg bg-card px-6 py-16 text-center shadow-soft">
      <CircleAlert className="size-10 text-loss" strokeWidth={1.25} aria-hidden="true" />
      <div className="flex flex-col gap-2">
        <p className="type-lead">Something went wrong on this page.</p>
        <p className="max-w-md type-body text-muted-foreground">
          Nothing was lost. Try again, and if it keeps happening, reload the app.
        </p>
      </div>
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="secondary" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </div>
    </div>
  );
}
