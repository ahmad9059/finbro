export function PageHeader({
  description,
  children,
}: {
  description: string;
  /** Actions: tint buttons first, the single primary button last. */
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="type-body-lg text-muted-foreground">{description}</p>
      {children ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {children}
        </div>
      ) : null}
    </div>
  );
}
