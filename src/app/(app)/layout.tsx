import { redirect } from "next/navigation";

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
        <div className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[1200px]">
            <ExpenseDialogProvider>{children}</ExpenseDialogProvider>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
