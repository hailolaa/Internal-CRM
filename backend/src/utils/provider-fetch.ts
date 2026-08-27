const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export type ProviderFetchOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  sleep?: (delayMs: number) => Promise<void>;
};

function retryAfterMs(response: Response) {
  const value = response.headers.get("retry-after");
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = new Date(value).getTime();
  return Number.isFinite(date) ? Math.max(date - Date.now(), 0) : null;
}

export async function fetchProvider(
  input: string | URL,
  init: RequestInit = {},
  options: ProviderFetchOptions = {},
) {
  const method = String(init.method || "GET").toUpperCase();
  const maxAttempts = SAFE_METHODS.has(method) ? Math.max(options.maxAttempts || 3, 1) : 1;
  const baseDelayMs = Math.max(options.baseDelayMs ?? 250, 0);
  const sleep = options.sleep || ((delayMs: number) => new Promise<void>((resolve) => setTimeout(resolve, delayMs)));

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(input, init);
      if (!RETRYABLE_STATUS_CODES.has(response.status) || attempt === maxAttempts) return response;
      await sleep(retryAfterMs(response) ?? baseDelayMs * 2 ** (attempt - 1));
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) throw error;
      await sleep(baseDelayMs * 2 ** (attempt - 1));
    }
  }

  throw lastError;
}
