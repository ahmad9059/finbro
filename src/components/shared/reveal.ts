/**
 * Row actions fade in on hover or keyboard focus, and stay visible where
 * hover does not exist (touch). Shared so every list behaves the same.
 */
export const REVEAL =
  "opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/row:opacity-100 [@media(hover:hover)]:group-focus-within/row:opacity-100 transition-opacity duration-150 ease-[var(--ease-out)]";
