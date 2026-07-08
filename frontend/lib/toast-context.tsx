// ============================================================
// Notification / Toast utility — Sonner-backed site-wide API
// ============================================================

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { toast as sonnerToast } from "sonner";

export interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info" | "warning";
  duration: number;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (message: string, type?: Toast["type"], duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function showToast(
  message: string,
  type: Toast["type"] = "success",
  duration = 3000,
) {
  const options = { duration };

  if (type === "error") {
    sonnerToast.error(message, options);
    return;
  }

  if (type === "warning") {
    sonnerToast.warning(message, options);
    return;
  }

  if (type === "info") {
    sonnerToast.info(message, options);
    return;
  }

  sonnerToast.success(message, options);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const addToast = useCallback(
    (message: string, type?: Toast["type"], duration?: number) => {
      showToast(message, type, duration);
    },
    [],
  );
  const removeToast = useCallback((id: string) => {
    sonnerToast.dismiss(id);
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      addToast,
      removeToast,
      toasts: [],
    }),
    [addToast, removeToast],
  );

  return (
    <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (ctx) return ctx;

  return {
    addToast: showToast,
    removeToast: (id: string) => {
      sonnerToast.dismiss(id);
    },
    toasts: [] as Toast[],
  };
}
