"use client";

import {
  Loader2,
  MessageSquarePlus,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "~/components/shared/confirm-dialog";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Skeleton } from "~/components/ui/skeleton";
import { formatDate } from "~/lib/format";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

import { ChatWindow } from "./chat-window";

type ProviderOption = {
  id: string;
  label: string;
  model: string;
  configured: boolean;
};

export function AssistantPage({ providers = [] }: { providers?: ProviderOption[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const requested = Number(params.get("t"));
  const threads = api.chat.threads.useQuery();
  const createThread = api.chat.createThread.useMutation();
  const rename = api.chat.renameThread.useMutation();
  const remove = api.chat.deleteThread.useMutation();

  const [historyOpen, setHistoryOpen] = useState(false);
  const firstConfigured = providers.find((provider) => provider.configured);
  const [activeProvider, setActiveProvider] = useState<ProviderOption | null>(
    firstConfigured ?? null,
  );
  const [renaming, setRenaming] = useState<{ id: number; title: string } | null>(null);
  const [deleting, setDeleting] = useState<{ id: number; title: string } | null>(null);
  const startedRef = useRef(false);

  const list = threads.data ?? [];
  const threadId = Number.isFinite(requested) && requested > 0 ? requested : null;
  const current = list.find((thread) => thread.id === threadId);

  // Opening the assistant always lands in a conversation: the latest one, or a
  // fresh one if this is the first visit.
  useEffect(() => {
    if (threadId || threads.isLoading || startedRef.current) return;
    if (list.length > 0) {
      router.replace(`/assistant?t=${list[0]!.id}`);
      return;
    }
    startedRef.current = true;
    void createThread
      .mutateAsync({ title: "New chat" })
      .then((thread) => router.replace(`/assistant?t=${thread.id}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run when the list settles
  }, [threadId, threads.isLoading, list]);

  const messages = api.chat.messages.useQuery(
    { threadId: threadId ?? 0 },
    { enabled: threadId !== null },
  );

  async function newChat() {
    const thread = await createThread.mutateAsync({ title: "New chat" });
    setHistoryOpen(false);
    router.push(`/assistant?t=${thread.id}`);
  }

  async function onRename() {
    if (!renaming) return;
    try {
      await rename.mutateAsync({ id: renaming.id, title: renaming.title });
      setRenaming(null);
      await threads.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not rename.");
    }
  }

  async function onDelete() {
    if (!deleting) return;
    try {
      await remove.mutateAsync({ id: deleting.id });
      setDeleting(null);
      const next = list.find((thread) => thread.id !== deleting.id);
      await threads.refetch();
      router.replace(next ? `/assistant?t=${next.id}` : "/assistant");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete.");
    }
  }

  const history = (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <Button variant="secondary" className="justify-start" onClick={() => void newChat()}>
        <MessageSquarePlus />
        New chat
      </Button>
      <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
        {threads.isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : list.length === 0 ? (
          <p className="px-1 type-ui-sm text-muted-foreground">No chats yet.</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {list.map((thread) => (
              <li key={thread.id}>
                <div
                  className={cn(
                    "group flex items-center gap-1 rounded-md pr-1 transition-colors",
                    thread.id === threadId ? "bg-accent" : "hover:bg-accent/60",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setHistoryOpen(false);
                      router.push(`/assistant?t=${thread.id}`);
                    }}
                    className="min-w-0 flex-1 rounded-md px-2.5 py-2 text-left"
                  >
                    <span className="block truncate type-ui-sm">{thread.title}</span>
                    <span className="type-legal text-muted-foreground">
                      {formatDate(thread.updatedAt.toISOString().slice(0, 10))}
                    </span>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Actions for ${thread.title}`}
                        className="opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
                      >
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onSelect={() => setRenaming({ id: thread.id, title: thread.title })}
                      >
                        <Pencil />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => setDeleting({ id: thread.id, title: thread.title })}
                      >
                        <Trash2 />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden">
      <aside className="hidden w-[268px] shrink-0 flex-col border-r border-border/70 bg-card p-3 lg:flex">
        {history}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-background">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border/70 px-4 lg:px-6">
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            aria-label="Chat history"
            onClick={() => setHistoryOpen(true)}
          >
            <MessageSquarePlus />
          </Button>
          <h1 className="min-w-0 flex-1 truncate type-ui-sm font-medium">
            {current?.title ?? "New chat"}
          </h1>
          {activeProvider ? (
            <span
              title={activeProvider.model}
              className="hidden rounded-full bg-secondary px-2.5 py-1 type-legal text-secondary-foreground sm:inline"
            >
              {activeProvider.label}
            </span>
          ) : null}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void newChat()}
            disabled={createThread.isPending}
          >
            {createThread.isPending ? <Loader2 className="animate-spin" /> : <MessageSquarePlus />}
            New chat
          </Button>
        </header>

        {threadId === null || messages.isLoading ? (
          <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            <span className="type-ui-sm">Opening your chat…</span>
          </div>
        ) : (
          <ChatWindow
            key={threadId}
            threadId={threadId}
            initialMessages={messages.data ?? []}
            onSaved={() => void threads.refetch()}
            onProvider={setActiveProvider}
            providers={providers}
          />
        )}
      </div>

      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent side="left" className="w-[280px] p-4">
          <SheetHeader className="mb-2 p-0">
            <SheetTitle className="type-ui-sm">Chats</SheetTitle>
          </SheetHeader>
          {history}
        </SheetContent>
      </Sheet>

      <Dialog open={renaming !== null} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Rename chat</DialogTitle>
          </DialogHeader>
          <Input
            value={renaming?.title ?? ""}
            onChange={(event) =>
              setRenaming((current) => (current ? { ...current, title: event.target.value } : current))
            }
            aria-label="Chat title"
            autoFocus
            onKeyDown={(event) => {
              if (event.key === "Enter") void onRename();
            }}
          />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
            <Button onClick={() => void onRename()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete "${deleting?.title ?? "this chat"}"?`}
        description="The conversation is removed. Nothing else changes."
        onConfirm={() => void onDelete()}
      />
    </div>
  );
}
