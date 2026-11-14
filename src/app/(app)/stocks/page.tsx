import type { Metadata } from "next";

import { PlaceholderPage } from "~/components/shared/placeholder-page";

export const metadata: Metadata = { title: "PSX Stocks" };

export default function Page() {
  return <PlaceholderPage href="/stocks" />;
}
