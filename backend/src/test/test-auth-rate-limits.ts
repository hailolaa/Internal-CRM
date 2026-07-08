import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import {
  authRateLimit,
  refreshTokenRateLimit,
} from "../middleware/rateLimit.js";

async function closeServer(server: Server) {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
  server.closeAllConnections();
}

const app = express();

app.post("/strict-auth", authRateLimit, (_req, res) => {
  res.json({ ok: true });
});

app.post("/refresh", refreshTokenRateLimit, (_req, res) => {
  res.json({ ok: true });
});

test("session refresh allows normal reload-heavy browser navigation without weakening strict auth limits", async () => {
  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start auth rate-limit test server");
  }

  const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;

  try {
    for (let index = 0; index < 5; index += 1) {
      const response = await fetch(`${baseUrl}/strict-auth`, {
        method: "POST",
      });
      assert.equal(response.status, 200);
    }

    const blockedStrictAuth = await fetch(`${baseUrl}/strict-auth`, {
      method: "POST",
    });
    assert.equal(blockedStrictAuth.status, 429);

    for (let index = 0; index < 20; index += 1) {
      const response = await fetch(`${baseUrl}/refresh`, {
        method: "POST",
      });
      assert.equal(response.status, 200);
    }
  } finally {
    await closeServer(server);
  }
});
