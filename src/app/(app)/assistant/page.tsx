import type { Metadata } from "next";
import { Suspense } from "react";

import { AssistantPage } from "~/features/assistant/assistant-page";
import { AssistantSkeleton } from "~/features/assistant/assistant-skeleton";

export const metadata: Metadata = { title: "Assistant" };

export default function Page() {
  return (
    <Suspense fallback={<AssistantSkeleton />}>
      <AssistantPage />
    </Suspense>
  );
}
