"use client";

import { usePathname } from "next/navigation";

import { SidebarTrigger } from "~/components/ui/sidebar";

import { findNavItem } from "./nav";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

/**
 * The top bar is night-coloured in both themes, so it carries the `dark` class
 * and everything inside it resolves to the dark tokens.
 */
export function TopBar({ user }: { user: { name: string; email: string } }) {
  const pathname = usePathname();
  const title = findNavItem(pathname)?.title ?? "finbro";

  return (
    <header className="dark sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 border-b border-sidebar-border bg-sidebar px-4 text-sidebar-foreground lg:px-8">
      <SidebarTrigger className="-ml-2 lg:hidden" />
      <h1 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-[0.3px]">
        {title}
      </h1>
      <ThemeToggle />
      <UserMenu name={user.name} email={user.email} />
    </header>
  );
}
