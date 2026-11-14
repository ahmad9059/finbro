"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "~/components/shared/logo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "~/components/ui/sidebar";

import { navGroups, settingsItem, type NavItem } from "./nav";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const active = isActive(pathname, item.href);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active}>
        <Link
          href={item.href}
          aria-current={active ? "page" : undefined}
          onClick={() => setOpenMobile(false)}
        >
          <item.icon strokeWidth={1.5} />
          <span>{item.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="h-16 shrink-0 flex-row items-center border-b border-sidebar-border bg-sidebar px-5 py-0">
        <Link
          href="/"
          className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <Logo />
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-2 px-1 py-3">
        {navGroups.map((group, index) => (
          <SidebarGroup key={group.label ?? index} className="px-2 py-1">
            {group.label ? (
              <SidebarGroupLabel className="h-8 px-3 type-eyebrow text-sidebar-muted-foreground">
                {group.label}
              </SidebarGroupLabel>
            ) : null}
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {group.items.map((item) => (
                  <NavLink key={item.href} item={item} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <SidebarMenu>
          <NavLink item={settingsItem} />
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
