"use client";

import { Eye, EyeOff } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

import { usePrivacy } from "./privacy-context";

/** The eye that hides every amount in the app. */
export function PrivacyToggle({
  className,
  size = "icon-sm",
}: {
  className?: string;
  size?: "icon-sm" | "icon";
}) {
  const { hidden, toggle } = usePrivacy();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size={size}
          onClick={toggle}
          aria-pressed={hidden}
          aria-label={hidden ? "Show amounts" : "Hide amounts"}
          className={cn("text-muted-foreground hover:text-foreground", className)}
        >
          {hidden ? <EyeOff /> : <Eye />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{hidden ? "Show amounts" : "Hide amounts"}</TooltipContent>
    </Tooltip>
  );
}
