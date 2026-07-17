import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/index.js";
import { authenticate } from "../middleware/authenticate.js";
import errorHandler from "../middleware/errorHandler.js";

async function closeServer(server: Server) {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function withAuthServer(run: (baseUrl: string) => Promise<void>) {
  const app = express();
  app.get("/protected", authenticate, (_req, res) => res.json({ ok: true }));
  app.use(errorHandler);

  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start authentication test server");
  }

  try {
    await run(`http://127.0.0.1:${(address as AddressInfo).port}`);
  } finally {
    await closeServer(server);
  }
}

test("expired access tokens return 401 so the client can refresh the session", async () => {
  const token = jwt.sign(
    { userId: "user-test", clinicId: "clinic-test", role: "ADMIN", email: "test@example.com" },
    config.jwt.secret,
    { expiresIn: -1 },
  );

  await withAuthServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/protected`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await response.json() as { message: string };

    assert.equal(response.status, 401);
    assert.equal(body.message, "Session expired");
  });
});

test("malformed access tokens return 401 instead of an internal server error", async () => {
  await withAuthServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/protected`, {
      headers: { Authorization: "Bearer not-a-jwt" },
    });
    const body = await response.json() as { message: string };

    assert.equal(response.status, 401);
    assert.equal(body.message, "Invalid authentication token");
  });
});
