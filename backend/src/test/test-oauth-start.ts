import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import app from "../app.js";
import { config } from "../config/index.js";

async function closeServer(server: ReturnType<typeof app.listen>) {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
  server.closeAllConnections();
}

test("OAuth start redirects missing provider configuration to frontend callback error state", async () => {
  const originalGoogleClientId = config.oauth.google.clientId;
  (config as any).oauth.google.clientId = "";

  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start OAuth start test server");
  }

  const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;

  try {
    const response = await fetch(`${baseUrl}/api/auth/oauth/google?mode=login&rememberMe=true`, {
      redirect: "manual",
    });

    assert.equal(response.status, 302);
    const location = response.headers.get("location") || "";
    assert.equal(location.startsWith(`${config.frontendUrl.replace(/\/$/, "")}/oauth/callback#`), true);

    const hash = location.split("#")[1] || "";
    const params = new URLSearchParams(hash);
    assert.match(params.get("error") || "", /Google OAuth is not configured/);
  } finally {
    (config as any).oauth.google.clientId = originalGoogleClientId;
    await closeServer(server);
  }
});
