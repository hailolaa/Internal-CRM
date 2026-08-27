import assert from "node:assert/strict";
import test from "node:test";
import { fetchProvider } from "../utils/provider-fetch.js";

test("provider fetch retries safe transient failures and honours Retry-After", async () => {
  const originalFetch = globalThis.fetch;
  const delays: number[] = [];
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts += 1;
    if (attempts === 1) return new Response("limited", { status: 429, headers: { "Retry-After": "2" } });
    if (attempts === 2) throw new Error("temporary network failure");
    return new Response("ok", { status: 200 });
  };

  try {
    const response = await fetchProvider("https://provider.example.test/items", {}, {
      maxAttempts: 3,
      baseDelayMs: 10,
      sleep: async (delay) => { delays.push(delay); },
    });
    assert.equal(response.status, 200);
    assert.equal(attempts, 3);
    assert.deepEqual(delays, [2000, 20]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("provider fetch does not retry unsafe mutations with an unknown result", async () => {
  const originalFetch = globalThis.fetch;
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts += 1;
    throw new Error("connection closed after request body was sent");
  };

  try {
    await assert.rejects(
      fetchProvider("https://provider.example.test/items", { method: "POST", body: "payload" }, {
        maxAttempts: 3,
        sleep: async () => undefined,
      }),
      /connection closed/,
    );
    assert.equal(attempts, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
