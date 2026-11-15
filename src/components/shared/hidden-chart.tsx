"use client";

import { Eye } from "lucide-react";

import { Button } from "~/components/ui/button";

import { usePrivacy } from "./privacy-context";

/**
 * Stands in for a chart while amounts are hidden: a chart is mostly numbers,
 * so showing its shape would give away the same information.
 */
export function HiddenChart({ label = "Chart" }: { label?: string }) {
  const { toggle } = usePrivacy();

  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center gap-4 rounded-md bg-muted/40 px-6 py-10 text-center">
      <p className="type-ui-sm text-muted-foreground">
        {label} hidden while amounts are masked.
      </p>
      <Button variant="secondary" size="sm" onClick={toggle}>
        <Eye />
        Show amounts
      </Button>
    </div>
  );
}
