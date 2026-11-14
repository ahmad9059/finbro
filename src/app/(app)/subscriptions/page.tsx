import type { Metadata } from "next";

import { SubscriptionsPage } from "~/features/subscriptions/subscriptions-page";

export const metadata: Metadata = { title: "Subscriptions" };

export default function Page() {
  return <SubscriptionsPage />;
}
