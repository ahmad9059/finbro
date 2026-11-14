"use client";

import { useState } from "react";

import { cn } from "~/lib/utils";

const TINTS = [
  "bg-[#5266eb]",
  "bg-[#7c8cf0]",
  "bg-[#554e7b]",
  "bg-[#9cb4e8]",
] as const;

/** "United Bank Limited" → "UB" */
function initials(name: string) {
  const skip = new Set(["ltd", "limited", "co", "company", "the", "of", "and"]);
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 0 && !skip.has(word.toLowerCase()));
  const letters = (words.length > 0 ? words : [name])
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
  return letters || "?";
}

/**
 * A company mark. The real logo is fetched once and cached for a week; when
 * the company has none, a tinted monogram keeps the column aligned.
 */
export function CompanyLogo({
  symbol,
  name,
  size = 32,
  className,
}: {
  symbol: string | null;
  name: string;
  /** Edge length in pixels. */
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const tint =
    TINTS[
      [...(symbol ?? name)].reduce((sum, char) => sum + char.charCodeAt(0), 0) %
        TINTS.length
    ];

  return (
    <span
      className={cn(
        // A white disc keeps dark and transparent logos legible in both themes.
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-black/10 dark:ring-white/15",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {/* The monogram sits underneath, so a slow first fetch shows initials
          instead of an empty ring. The logo fades in over it. */}
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center font-medium text-white",
          tint,
        )}
        style={{ fontSize: size * 0.34, letterSpacing: "0.02em" }}
      >
        {initials(name)}
      </span>
      {symbol && !failed ? (
        <img
          src={`/api/logo/${encodeURIComponent(symbol)}`}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          className={cn(
            "absolute inset-0 size-full bg-white object-contain p-[15%] transition-opacity duration-150",
            loaded ? "opacity-100" : "opacity-0",
          )}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      ) : null}
    </span>
  );
}
