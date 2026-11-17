"use client";

import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Field, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useMounted } from "~/hooks/use-mounted";
import { errorMessage } from "~/lib/errors";
import { api } from "~/trpc/react";

/**
 * The account's assistant settings. Held back until mounted: a cached copy
 * from this browser's storage would otherwise render on the client but not in
 * the server HTML, which breaks hydration.
 */
function useAssistantSettings(options?: { staleTime?: number }) {
  const mounted = useMounted();
  const { data } = api.assistant.settings.useQuery(undefined, options);
  return mounted ? data : undefined;
}

/** The model picker. Applies to the next message. */
export function ModelSelect({ className }: { className?: string }) {
  const utils = api.useUtils();
  const data = useAssistantSettings({ staleTime: 60_000 });
  const save = api.assistant.saveSettings.useMutation({
    onSuccess: () => {
      void utils.assistant.settings.invalidate();
      toast.success("Model updated.");
    },
    onError: (error) => toast.error(errorMessage(error, "Could not change model.")),
  });

  return (
    <Select
      value={data?.model ?? ""}
      onValueChange={(model) => save.mutate({ model })}
      disabled={save.isPending || !data}
    >
      <SelectTrigger
        size="sm"
        aria-label="Model"
        className={className}
        title={data?.models.find((model) => model.id === data.model)?.note}
      >
        <SelectValue placeholder="Model" />
      </SelectTrigger>
      <SelectContent align="end">
        {data?.models.map((model) => (
          <SelectItem key={model.id} value={model.id} title={model.note}>
            {model.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Bring-your-own-key entry point for the chat header. */
export function AssistantKeyButton({ withLabel = false }: { withLabel?: boolean }) {
  const [open, setOpen] = useState(false);
  const data = useAssistantSettings({ staleTime: 60_000 });

  return (
    <>
      <Button
        variant="ghost"
        size={withLabel ? "sm" : "icon-sm"}
        onClick={() => setOpen(true)}
        aria-label="Assistant API key"
        className={withLabel ? undefined : "text-muted-foreground hover:text-foreground"}
      >
        <KeyRound />
        {withLabel ? (data?.hasUserKey ? "Your key" : "Add key") : null}
        {data && !data.ready ? (
          <span
            aria-hidden="true"
            className="size-1.5 rounded-full bg-loss"
            title="No key available"
          />
        ) : null}
      </Button>
      <AssistantKeyDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

export function AssistantKeyDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = api.useUtils();
  const { data } = api.assistant.settings.useQuery(undefined, {
    enabled: open,
    staleTime: 0,
  });
  const [apiKey, setApiKey] = useState("");
  const save = api.assistant.saveSettings.useMutation();
  const clear = api.assistant.clearKey.useMutation();

  async function onSave() {
    try {
      await save.mutateAsync({ apiKey });
      await utils.assistant.settings.invalidate();
      setApiKey("");
      onOpenChange(false);
      toast.success("Key saved. Only this account can use it.");
    } catch (error) {
      toast.error(errorMessage(error, "Could not save the key."));
    }
  }

  async function onClear() {
    try {
      await clear.mutateAsync();
      await utils.assistant.settings.invalidate();
      onOpenChange(false);
      toast.success(
        data?.hasServerKey
          ? "Your key was removed. The server key will be used."
          : "Your key was removed. Add one to use the assistant.",
      );
    } catch (error) {
      toast.error(errorMessage(error, "Could not remove the key."));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Assistant API key</DialogTitle>
          <DialogDescription>
            Use your own Anthropic key for this account. It is stored encrypted
            on the server and never sent back to the browser.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-3 rounded-md bg-muted/60 p-3">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-gain" aria-hidden="true" />
            <p className="type-ui-sm text-muted-foreground">
              {data?.hasUserKey
                ? `Using your key (${data.keyHint}).`
                : data?.hasServerKey
                  ? "No personal key saved — the server's key is being used."
                  : "No key available yet. The assistant cannot answer until one is added."}
            </p>
          </div>

          <Field>
            <FieldLabel htmlFor="anthropic-key">Anthropic API key</FieldLabel>
            <Input
              id="anthropic-key"
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="sk-ant-api03-…"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
            />
            <p className="type-legal text-muted-foreground">
              From{" "}
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noreferrer noopener"
                className="text-link underline underline-offset-2"
              >
                console.anthropic.com
              </a>
              . Saves over any key already stored here.
            </p>
          </Field>
        </div>

        <DialogFooter>
          {data?.hasUserKey ? (
            <Button
              variant="destructive"
              onClick={() => void onClear()}
              disabled={clear.isPending}
            >
              Remove key
            </Button>
          ) : null}
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => void onSave()}
            disabled={save.isPending || apiKey.trim().length < 20}
          >
            {save.isPending ? <Loader2 className="animate-spin" /> : null}
            Save key
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Full-width version for the Settings page. */
export function AssistantSettingsCard() {
  const data = useAssistantSettings();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-2">
          <span className="type-ui-sm text-muted-foreground">Model</span>
          <ModelSelect className="w-60" />
          <span className="type-legal text-muted-foreground">
            {data?.models.find((model) => model.id === data.model)?.note}
          </span>
        </div>
        <AssistantKeyButton withLabel />
      </div>
      <p className="type-ui-sm text-muted-foreground">
        {data?.hasUserKey
          ? `Your own key is stored (${data.keyHint}).`
          : data?.hasServerKey
            ? "Using the server's key. Add your own to keep usage on your Anthropic account."
            : "No key yet — add one to start using the assistant."}
      </p>
    </div>
  );
}
