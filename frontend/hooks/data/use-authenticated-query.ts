"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { getErrorMessage } from "@/lib/errors";
import { useToast } from "@/lib/toast-context";

type QueryStatus = "loading" | "success" | "error";

interface AuthenticatedQueryOptions<T> {
  errorMessage: string;
  initialData: T;
  onSuccess?: (data: T) => void;
  query: (token: string) => Promise<T>;
}

export function useAuthenticatedQuery<T>({
  errorMessage,
  initialData,
  onSuccess,
  query,
}: AuthenticatedQueryOptions<T>) {
  const { session } = useAuth();
  const { addToast } = useToast();
  const token = session?.token;
  const [data, setData] = useState<T>(initialData);
  const [status, setStatus] = useState<QueryStatus>("loading");

  const reload = useCallback(async () => {
    if (!token) return false;

    setStatus("loading");
    try {
      const result = await query(token);
      setData(result);
      onSuccess?.(result);
      setStatus("success");
      return true;
    } catch (error: unknown) {
      addToast(getErrorMessage(error, errorMessage), "error");
      setStatus("error");
      return false;
    }
  }, [addToast, errorMessage, onSuccess, query, token]);

  useEffect(() => {
    if (!token) return;
    let isMounted = true;

    query(token)
      .then((result) => {
        if (!isMounted) return;
        setData(result);
        onSuccess?.(result);
        setStatus("success");
      })
      .catch((error: unknown) => {
        if (!isMounted) return;
        addToast(getErrorMessage(error, errorMessage), "error");
        setStatus("error");
      });

    return () => {
      isMounted = false;
    };
  }, [addToast, errorMessage, onSuccess, query, token]);

  return {
    data,
    isError: status === "error",
    isLoading: status === "loading",
    isSuccess: status === "success",
    reload,
    setData,
    status,
  } as const;
}
