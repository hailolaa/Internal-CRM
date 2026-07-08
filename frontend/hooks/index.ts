"use client";

import { useState, useCallback, useMemo, useEffect } from "react";

// --- useClipboard ---
export function useClipboard(resetMs = 2000) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(
    async (text: string) => {
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), resetMs);
      } catch {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        setCopied(true);
        setTimeout(() => setCopied(false), resetMs);
      }
    },
    [resetMs],
  );

  return { copied, copy } as const;
}

// --- useAsyncAction ---
type AsyncStatus = "idle" | "loading" | "success" | "error";

export function useAsyncAction<T = unknown>() {
  const [status, setStatus] = useState<AsyncStatus>("idle");
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (fn: () => Promise<T> | T) => {
    setStatus("loading");
    setError(null);
    try {
      const result = await fn();
      setData(result);
      setStatus("success");
      return result;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      setStatus("error");
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setData(null);
    setError(null);
  }, []);

  return {
    status,
    data,
    error,
    execute,
    reset,
    isLoading: status === "loading",
    isSuccess: status === "success",
    isError: status === "error",
  } as const;
}

// --- useSimulatedAction ---
export function useSimulatedAction<T>(delayMs = 1500) {
  const [status, setStatus] = useState<AsyncStatus>("idle");
  const [output, setOutput] = useState<T | null>(null);

  const run = useCallback(
    (buildResult: () => T) => {
      setStatus("loading");
      setOutput(null);
      setTimeout(() => {
        setOutput(buildResult());
        setStatus("success");
      }, delayMs);
    },
    [delayMs],
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setOutput(null);
  }, []);

  return {
    status,
    output,
    run,
    reset,
    isLoading: status === "loading",
    isSuccess: status === "success",
  } as const;
}

// --- useFormFields ---
export function useFormFields<T extends Record<string, string>>(initial: T) {
  const [fields, setFields] = useState<T>(initial);

  const setField = useCallback((key: keyof T, value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetFields = useCallback(() => {
    setFields(initial);
  }, [initial]);

  /**
   * handleChange — returns a handler compatible with native change events.
   * Kept for backward compatibility with raw <input>/<select> elements.
   */
  const handleChange = useCallback(
    (key: keyof T) =>
      (
        e: React.ChangeEvent<
          HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
        >,
      ) => {
        setField(key, e.target.value);
      },
    [setField],
  );

  /**
   * updateField — direct string setter for use with FormField's `onChange: (value: string) => void`.
   * Eliminates the `{ target: { value: v } } as React.ChangeEvent` adapter pattern.
   *
   * Usage: <FormField onChange={updateField("myKey")} />
   */
  const updateField = useCallback(
    (key: keyof T) => (value: string) => {
      setField(key, value);
    },
    [setField],
  );

  return { fields, setField, resetFields, handleChange, updateField } as const;
}

// --- useToggle ---
export function useToggle(initial = false) {
  const [value, setValue] = useState(initial);
  const toggle = useCallback(() => setValue((v) => !v), []);
  const setOn = useCallback(() => setValue(true), []);
  const setOff = useCallback(() => setValue(false), []);
  return { value, toggle, setOn, setOff, set: setValue } as const;
}

// --- useTabFilter ---
export function useTabFilter<T extends string>(initial: T) {
  const [active, setActive] = useState<T>(initial);
  const isActive = useCallback((tab: T) => active === tab, [active]);
  return { active, setActive, isActive } as const;
}

// --- useSearch ---
export function useSearch<T>(
  items: T[],
  searchFn: (item: T, query: string) => boolean,
) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    return items.filter((item) => searchFn(item, query.toLowerCase()));
  }, [items, query, searchFn]);

  return {
    query,
    setQuery,
    filtered,
    hasQuery: query.trim().length > 0,
  } as const;
}

// --- useMultiSelect ---
export function useMultiSelect<T extends string>(allIds: T[]) {
  const [selected, setSelected] = useState<Set<T>>(new Set());

  const toggle = useCallback((id: T) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) =>
      prev.size === allIds.length ? new Set() : new Set(allIds),
    );
  }, [allIds]);

  const clear = useCallback(() => setSelected(new Set()), []);

  const isSelected = useCallback((id: T) => selected.has(id), [selected]);
  const isAllSelected = selected.size === allIds.length && allIds.length > 0;
  const count = selected.size;

  return {
    selected,
    toggle,
    toggleAll,
    clear,
    isSelected,
    isAllSelected,
    count,
  } as const;
}

// --- useStepWizard ---
export function useStepWizard(totalSteps: number, initialStep = 1) {
  const [step, setStep] = useState(initialStep);

  const next = useCallback(() => {
    setStep((s) => Math.min(s + 1, totalSteps));
  }, [totalSteps]);

  const prev = useCallback(() => {
    setStep((s) => Math.max(s - 1, 1));
  }, []);

  const goTo = useCallback(
    (s: number) => {
      setStep(Math.max(1, Math.min(s, totalSteps)));
    },
    [totalSteps],
  );

  const isFirst = step === 1;
  const isLast = step === totalSteps;
  const progress = (step / totalSteps) * 100;

  return {
    step,
    next,
    prev,
    goTo,
    isFirst,
    isLast,
    progress,
    totalSteps,
  } as const;
}

// --- useMediaQuery ---
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const media = window.matchMedia(query);

    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [query]);

  return matches;
}

export function useIsMobile() {
  return useMediaQuery("(max-width: 767px)");
}

export function useIsDesktop() {
  return useMediaQuery("(min-width: 1024px)");
}

// --- useDebounce ---
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
