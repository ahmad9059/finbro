"use client";

import { usePathname } from "next/navigation";

import { PrivacyToggle } from "~/components/shared/privacy-toggle";
import { SidebarTrigger } from "~/components/ui/sidebar";

import { findNavItem } from "./nav";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

/** The shell follows the theme: a white rail by day, night at night. */
export function TopBar({
  user,
}: {
  user: { name: string; email: string; image?: string | null };
}) {
  const pathname = usePathname();
  const item = findNavItem(pathname);
  const title = item?.title ?? "finbro";
  const Icon = item?.icon;

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 border-b border-sidebar-border bg-sidebar px-4 text-sidebar-foreground lg:px-8">
      <SidebarTrigger className="-ml-2 lg:hidden" />
      <h1 className="flex min-w-0 flex-1 items-center gap-2.5 truncate text-lg font-semibold tracking-[0.3px]">
        {Icon ? (
          <Icon
            className="size-[18px] shrink-0 text-sidebar-muted-foreground"
            strokeWidth={1.5}
            aria-hidden="true"
          />
        ) : null}
        <span className="truncate">{title}</span>
      </h1>
      <PrivacyToggle />
      <ThemeToggle />
      <UserMenu name={user.name} email={user.email} image={user.image} />
    </header>
  );
}
