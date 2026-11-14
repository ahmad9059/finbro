"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { ExpenseDialog, type EditableExpense } from "./expense-dialog";

type ExpenseDialogContextValue = {
  open: (expense?: EditableExpense) => void;
};

const ExpenseDialogContext = createContext<ExpenseDialogContextValue | null>(
  null,
);

/** "Add expense" from anywhere: a button, or the E key. */
export function ExpenseDialogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [expense, setExpense] = useState<EditableExpense | null>(null);

  const openWith = useCallback((next?: EditableExpense) => {
    setExpense(next ?? null);
    setOpen(true);
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;
      if (event.key.toLowerCase() !== "e" || typing) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      event.preventDefault();
      openWith();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openWith]);

  const value = useMemo(() => ({ open: openWith }), [openWith]);

  return (
    <ExpenseDialogContext.Provider value={value}>
      {children}
      <ExpenseDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setExpense(null);
        }}
        expense={expense}
      />
    </ExpenseDialogContext.Provider>
  );
}

export function useExpenseDialog() {
  const context = useContext(ExpenseDialogContext);
  if (!context) {
    throw new Error("useExpenseDialog must be used inside ExpenseDialogProvider");
  }
  return context;
}
