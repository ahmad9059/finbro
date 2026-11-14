import type { LucideIcon } from "lucide-react";

import { cn } from "~/lib/utils";

/** A titled panel: surface + soft shadow in light, night-raised in dark. */
export function Section({
  title,
  description,
  action,
  icon: Icon,
  children,
  className,
  flush = false,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  /** A small mark beside the title, to match the KPI row. */
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
  /** Remove body padding (for tables that run edge to edge). */
  flush?: boolean;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-lg bg-card text-card-foreground shadow-soft",
        className,
      )}
    >
      {title ? (
        <header className="flex items-start justify-between gap-4 px-6 pt-6">
          <div className="flex flex-col gap-1.5">
            <h2 className="flex items-center gap-2 type-eyebrow text-muted-foreground">
              {Icon ? (
                <Icon
                  className="size-3.5"
                  aria-hidden="true"
                />
              ) : null}
              {title}
            </h2>
            {description ? (
              <p className="type-ui-sm font-normal text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          {action}
        </header>
      ) : null}
      <div className={cn(flush ? "pt-2" : "p-6", title && !flush && "pt-5")}>
        {children}
      </div>
    </section>
  );
}
