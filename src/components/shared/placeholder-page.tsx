import { EmptyState } from "~/components/shared/empty-state";
import { PageHeader } from "~/components/shared/page-header";
import { allNavItems } from "~/components/shell/nav";

/** Temporary body for pages whose feature has not been built yet. */
export function PlaceholderPage({ href }: { href: string }) {
  const item = allNavItems.find((entry) => entry.href === href);
  if (!item) return null;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader description={item.description} />
      <EmptyState icon={item.icon} title={`${item.title} will appear here.`} />
    </div>
  );
}
