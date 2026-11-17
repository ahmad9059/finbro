import { useSyncExternalStore } from "react";

const subscribe = () => () => undefined;

/**
 * False while the server renders and during hydration, true afterwards. Use it
 * to hold back anything that comes from this browser's storage (such as the
 * persisted query cache), so the first client render matches the server HTML.
 */
export function useMounted() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
