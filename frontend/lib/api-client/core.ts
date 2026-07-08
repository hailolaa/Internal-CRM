import { publicEnv } from "@/lib/env";
import type { ApiEnvelope } from "@/lib/api-types";

export type ApiRequestOptions = RequestInit & {
  token?: string;
  retry?: boolean;
};

export type ApiRequest = <T>(
  path: string,
  options?: ApiRequestOptions,
) => Promise<ApiEnvelope<T>>;

type AuthRefreshHandler = () => Promise<string | null>;

let authRefreshHandler: AuthRefreshHandler | null = null;

export class ApiClientError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
  }
}

export function configureApiAuthRefresh(handler: AuthRefreshHandler) {
  authRefreshHandler = handler;
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
) {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(
    `${publicEnv.apiBaseUrl}/${path.replace(/^\/+/, "").replace(/^api\//, "")}`,
    {
      ...options,
      cache: options.cache || "no-store",
      headers,
    },
  );

  const text = await response.text();
  let payload: ApiEnvelope<T> | undefined;

  try {
    payload = text ? (JSON.parse(text) as ApiEnvelope<T>) : undefined;
  } catch {
    payload = undefined;
  }

  if (!response.ok) {
    if (response.status === 401 && options.token && !options.retry) {
      const refreshedToken = await authRefreshHandler?.();
      if (refreshedToken) {
        return apiRequest<T>(path, {
          ...options,
          token: refreshedToken,
          retry: true,
        });
      }
    }

    throw new ApiClientError(
      payload?.message || `Request failed with ${response.status}`,
      response.status,
    );
  }

  return payload as ApiEnvelope<T>;
}
