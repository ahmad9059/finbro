import type { LucideIcon } from "lucide-react";

import { cn } from "~/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  /** The page's primary action, if there is one. */
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-5 rounded-lg bg-tint px-6 py-16 text-center text-tint-foreground",
        className,
      )}
    >
      <Icon
        className="size-10 text-muted-foreground"
        strokeWidth={1.25}
        aria-hidden="true"
      />
      <p className="max-w-md type-body-lg text-balance">{title}</p>
      {children}
    </div>
  );
}
