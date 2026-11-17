import { redirect } from "next/navigation";

import { AppContent } from "~/components/shell/app-content";
import { AppSidebar } from "~/components/shell/app-sidebar";
import { ExpenseDialogProvider } from "~/features/expenses/expense-dialog-provider";
import { TopBar } from "~/components/shell/top-bar";
import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar";
import { getSession } from "~/server/better-auth/server";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // proxy.ts only checks that a cookie exists. This is the real check.
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <TopBar
          user={{
            name: session.user.name,
            email: session.user.email,
            image: session.user.image,
          }}
        />
        <AppContent>
          <ExpenseDialogProvider>{children}</ExpenseDialogProvider>
        </AppContent>
      </SidebarInset>
    </SidebarProvider>
  );
}
