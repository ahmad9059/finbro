import type { Metadata } from "next";

import { SavingsPage } from "~/features/savings/savings-page";

export const metadata: Metadata = { title: "Savings Accounts" };

export default function Page() {
  return <SavingsPage />;
}
