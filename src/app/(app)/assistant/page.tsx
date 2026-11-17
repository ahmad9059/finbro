import type { Metadata } from "next";
import { Suspense } from "react";

import { Skeleton } from "~/components/ui/skeleton";
import { AssistantPage } from "~/features/assistant/assistant-page";
import { listProviders } from "~/server/assistant/providers";

export const metadata: Metadata = { title: "Assistant" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-[60svh] w-full" />}>
      <AssistantPage providers={listProviders()} />
    </Suspense>
  );
}
