"use client";

import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "~/components/shared/confirm-dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { api } from "~/trpc/react";

export function CategoriesSection() {
  const utils = api.useUtils();
  const { data, isLoading } = api.category.list.useQuery();
  const create = api.category.create.useMutation();
  const rename = api.category.rename.useMutation();
  const remove = api.category.delete.useMutation();

  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);
  const [deleting, setDeleting] = useState<{ id: number; name: string } | null>(
    null,
  );

  async function invalidate() {
    await Promise.all([
      utils.category.list.invalidate(),
      utils.expense.list.invalidate(),
      utils.subscription.list.invalidate(),
    ]);
  }

  async function onAdd(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    try {
      await create.mutateAsync({ name });
      setName("");
      toast.success("Category added.");
      await invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add.");
    }
  }

  async function onRename() {
    if (!editing) return;
    try {
      await rename.mutateAsync({ id: editing.id, name: editing.name });
      setEditing(null);
      toast.success("Category renamed.");
      await invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not rename.");
    }
  }

  async function onDelete() {
    if (!deleting) return;
    try {
      await remove.mutateAsync({ id: deleting.id });
      toast.success("Category deleted.");
      await invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete.");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={(event) => void onAdd(event)} className="flex gap-2">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="New category"
          aria-label="New category name"
          className="max-w-64"
        />
        <Button type="submit" variant="secondary" disabled={!name.trim()}>
          <Plus />
          Add
        </Button>
      </form>

      {isLoading ? (
        <p className="flex items-center gap-2 text-ui-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading
        </p>
      ) : (
        <ul className="divide-y">
          {data?.map((category) => (
            <li
              key={category.id}
              className="flex items-center justify-between gap-3 py-3"
            >
              {editing?.id === category.id ? (
                <Input
                  value={editing.name}
                  onChange={(event) =>
                    setEditing({ id: category.id, name: event.target.value })
                  }
                  aria-label={`Rename ${category.name}`}
                  className="h-8 max-w-64"
                  autoFocus
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void onRename();
                    if (event.key === "Escape") setEditing(null);
                  }}
                />
              ) : (
                <span className="text-ui-sm">
                  {category.name}
                  <span className="ml-2 text-legal text-muted-foreground">
                    {category.usage} {category.usage === 1 ? "entry" : "entries"}
                  </span>
                </span>
              )}
              <span className="flex shrink-0 gap-1">
                {editing?.id === category.id ? (
                  <Button size="sm" variant="secondary" onClick={() => void onRename()}>
                    Save
                  </Button>
                ) : (
                  <>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Rename ${category.name}`}
                      onClick={() => setEditing(category)}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Delete ${category.name}`}
                      onClick={() => setDeleting(category)}
                    >
                      <Trash2 />
                    </Button>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name ?? "this category"}?`}
        description="Categories in use cannot be deleted; rename them instead."
        onConfirm={() => void onDelete()}
      />
    </div>
  );
}
