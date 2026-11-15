"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "finbro:hideAmounts";
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const getSnapshot = () =>
  typeof window !== "undefined" && window.localStorage.getItem(STORAGE_KEY) === "1";

const getServerSnapshot = () => false;

/**
 * One switch for the whole app: when amounts are hidden, every money value,
 * percentage and chart is masked. The choice is remembered per browser and
 * follows the account across tabs.
 */
export function usePrivacy() {
  const hidden = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return {
    hidden,
    toggle: () => {
      window.localStorage.setItem(STORAGE_KEY, hidden ? "0" : "1");
      for (const listener of listeners) listener();
    },
  };
}

/** What a hidden value looks like. */
export const MASK = "••••••";
