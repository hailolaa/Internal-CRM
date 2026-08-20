import { publicEnv } from "@/lib/env";
import type { ApiEnvelope } from "@/lib/api-types";
import {
  createClientCorrelationId,
  recordApiFailure,
} from "@/lib/client-observability";

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

function readPayloadRequestId(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("requestId" in payload)) return null;
  const requestId = (payload as { requestId?: unknown }).requestId;
  return typeof requestId === "string" && requestId.trim() ? requestId : null;
}

export class ApiClientError extends Error {
  status: number;
  requestId?: string | null;

  constructor(message: string, status: number, requestId?: string | null) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.requestId = requestId || null;
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
  const correlationId = headers.get("x-correlation-id") || createClientCorrelationId();
  headers.set("x-correlation-id", correlationId);
  if (!headers.has("x-request-id")) {
    headers.set("x-request-id", correlationId);
  }

  if (
    options.body &&
    !headers.has("Content-Type") &&
    !(typeof FormData !== "undefined" && options.body instanceof FormData)
  ) {
    headers.set("Content-Type", "application/json");
  }

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const normalizedPath = path.replace(/^\/+/, "").replace(/^api\//, "");
  const response = await fetch(`${publicEnv.apiBaseUrl}/${normalizedPath}`, {
    ...options,
    cache: options.cache || "no-store",
    headers,
  }).catch((error) => {
    recordApiFailure({
      path: `/${normalizedPath}`,
      method: options.method || "GET",
      statusCode: null,
      correlationId,
      message: "API request failed before a response was received.",
      error,
    });
    throw error;
  });

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

    const requestId = response.headers?.get?.("x-request-id") || readPayloadRequestId(payload);
    const message = payload?.message || `Request failed with ${response.status}`;
    recordApiFailure({
      path: `/${normalizedPath}`,
      method: options.method || "GET",
      statusCode: response.status,
      requestId,
      correlationId,
      message,
    });

    throw new ApiClientError(message, response.status, requestId);
  }

  return payload as ApiEnvelope<T>;
}

export async function downloadCsv(
  path: string,
  token: string,
  fallbackFileName: string,
) {
  const normalizedPath = path.replace(/^\/+/, "").replace(/^api\//, "");
  const correlationId = createClientCorrelationId();
  const response = await fetch(`${publicEnv.apiBaseUrl}/${normalizedPath}`, {
    cache: "no-store",
    headers: {
      Accept: "text/csv",
      Authorization: `Bearer ${token}`,
      "x-correlation-id": correlationId,
      "x-request-id": correlationId,
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const requestId = response.headers?.get?.("x-request-id") || payload?.requestId || null;
    const message = payload?.message || `CSV export failed with ${response.status}`;
    recordApiFailure({
      path: `/${normalizedPath}`,
      method: "GET",
      statusCode: response.status,
      requestId,
      correlationId,
      message,
    });
    throw new ApiClientError(message, response.status, requestId);
  }

  const disposition = response.headers.get("content-disposition") || "";
  const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const fileName = encodedName
    ? decodeURIComponent(encodedName)
    : disposition.match(/filename="([^"]+)"/)?.[1] || fallbackFileName;

  return { blob: await response.blob(), fileName };
}
