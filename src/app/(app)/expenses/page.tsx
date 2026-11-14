import type { Metadata } from "next";
import { Suspense } from "react";

import { TableSkeleton } from "~/components/shared/table-skeleton";
import { ExpensesPage } from "~/features/expenses/expenses-page";

export const metadata: Metadata = { title: "Monthly Expenses" };

export default function Page() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <ExpensesPage />
    </Suspense>
  );
}
