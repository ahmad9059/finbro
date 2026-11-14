import { cn } from "~/lib/utils";

/** A titled panel: surface + soft shadow in light, night-raised in dark. */
export function Section({
  title,
  description,
  action,
  children,
  className,
  flush = false,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
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
            <h2 className="type-eyebrow text-muted-foreground">{title}</h2>
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
