import { Skeleton } from "~/components/ui/skeleton";

/*
 * Loading placeholders for the assistant. Each one copies the box model of the
 * real thing in assistant-page.tsx and chat-window.tsx (same widths, paddings
 * and borders), so nothing jumps when the content arrives.
 */

/** Rows in the history list: a title line and a date line, as in the real rows. */
export function HistorySkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <ul className="flex flex-col gap-0.5" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} className="flex flex-col gap-1.5 px-2.5 py-2">
          <Skeleton
            className="h-4"
            style={{ width: `${[78, 62, 84, 55, 70][index % 5]}%` }}
          />
          <Skeleton className="h-3 w-16" />
        </li>
      ))}
    </ul>
  );
}

function AssistantLine({ widths }: { widths: string[] }) {
  return (
    <div className="flex gap-3">
      <Skeleton className="mt-0.5 size-7 shrink-0 rounded-full" />
      <div className="flex min-w-0 flex-1 flex-col gap-2.5 pt-1">
        {widths.map((width, index) => (
          <Skeleton key={index} className="h-4" style={{ width }} />
        ))}
      </div>
    </div>
  );
}

function UserBubble({ width }: { width: string }) {
  return (
    <div className="flex justify-end">
      <Skeleton
        className="h-11 max-w-[85%] rounded-2xl rounded-br-md"
        style={{ width }}
      />
    </div>
  );
}

/** The scrolling message area and the composer under it. */
export function ChatSkeleton() {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      role="status"
      aria-busy="true"
      aria-label="Opening your chat"
    >
      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="mx-auto flex w-full max-w-[920px] flex-col gap-6 px-4 py-6 lg:px-2 2xl:max-w-[1180px]">
          <UserBubble width="46%" />
          <AssistantLine widths={["92%", "86%", "64%"]} />
          <UserBubble width="32%" />
          <AssistantLine widths={["88%", "95%", "72%", "40%"]} />
        </div>
      </div>

      <div className="border-t border-border/70 bg-background">
        <div className="mx-auto flex w-full max-w-[920px] flex-col gap-2 px-4 py-4 lg:px-2 2xl:max-w-[1180px]">
          <div className="flex items-end gap-2 rounded-2xl border border-input bg-card p-2 shadow-soft">
            <div className="flex min-h-10 flex-1 items-center px-2">
              <Skeleton className="h-4 w-56 max-w-full" />
            </div>
            <Skeleton className="size-9 shrink-0 rounded-full" />
          </div>
          <div className="flex h-4 items-center px-1">
            <Skeleton className="h-3 w-72 max-w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** The whole page, for the route's Suspense fallback. */
export function AssistantSkeleton() {
  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden">
      <aside className="hidden w-[268px] shrink-0 flex-col border-r border-border/70 bg-card p-3 lg:flex">
        <Skeleton className="h-8 w-full rounded-md" />
        <div className="mt-4 min-h-0 flex-1 overflow-hidden">
          <HistorySkeleton />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-background">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border/70 px-4 lg:px-6">
          <Skeleton className="size-8 shrink-0 rounded-md lg:hidden" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="hidden h-8 w-40 rounded-md sm:block" />
          <Skeleton className="size-8 rounded-md" />
          <Skeleton className="h-8 w-[104px] rounded-md" />
        </header>
        <ChatSkeleton />
      </div>
    </div>
  );
}
