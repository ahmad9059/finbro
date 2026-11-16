import {
  CandlestickChart,
  Landmark,
  LayoutDashboard,
  PieChart,
  ReceiptText,
  Repeat,
  Settings,
  Sparkles,
  Vault,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  description: string;
};

export type NavGroup = {
  label?: string;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    items: [
      {
        title: "Overview",
        href: "/",
        icon: LayoutDashboard,
        description: "Your net worth and this month at a glance.",
      },
      {
        title: "Assistant",
        href: "/assistant",
        icon: Sparkles,
        description: "Ask about your holdings, spending and subscriptions.",
      },
    ],
  },
  {
    label: "Investments",
    items: [
      {
        title: "PSX Stocks",
        href: "/stocks",
        icon: CandlestickChart,
        description: "Shares you hold on the Pakistan Stock Exchange.",
      },
      {
        title: "Mutual Funds",
        href: "/mutual-funds",
        icon: PieChart,
        description: "Equity, income and other mutual fund holdings.",
      },
      {
        title: "Money Market",
        href: "/money-market",
        icon: Landmark,
        description: "Money market fund holdings.",
      },
      {
        title: "Savings Accounts",
        href: "/savings",
        icon: Vault,
        description: "Bank balances and the profit they earn.",
      },
    ],
  },
  {
    label: "Expenses",
    items: [
      {
        title: "Monthly Expenses",
        href: "/expenses",
        icon: ReceiptText,
        description: "Everything you spent, month by month.",
      },
      {
        title: "Subscriptions",
        href: "/subscriptions",
        icon: Repeat,
        description: "Recurring services and when they are due.",
      },
    ],
  },
];

export const settingsItem: NavItem = {
  title: "Settings",
  href: "/settings",
  icon: Settings,
  description: "Categories, password and appearance.",
};

export const allNavItems: NavItem[] = [
  ...navGroups.flatMap((group) => group.items),
  settingsItem,
];

export function findNavItem(pathname: string): NavItem | undefined {
  return allNavItems.find((item) =>
    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href),
  );
}
