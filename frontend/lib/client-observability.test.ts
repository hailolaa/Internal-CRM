import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildClientObservabilityEvent,
  createClientCorrelationId,
  redactClientTelemetry,
  resetClientObservabilityForTests,
} from "@/lib/client-observability";
import { apiRequest, ApiClientError } from "@/lib/api-client/core";

afterEach(() => {
  vi.restoreAllMocks();
  resetClientObservabilityForTests();
});

describe("client observability", () => {
  it("redacts personal and secret values before telemetry leaves the browser", () => {
    const sanitized = redactClientTelemetry({
      email: "patient@example.com",
      phone: "+44 7700 900123",
      token: "sk_live_secret",
      nested: { safe: "visible" },
    });

    const serialized = JSON.stringify(sanitized);
    expect(serialized).not.toContain("patient@example.com");
    expect(serialized).not.toContain("+44 7700");
    expect(serialized).not.toContain("sk_live_secret");
    expect(serialized).toContain("visible");
  });

  it("builds provider-neutral frontend events with release metadata", () => {
    const event = buildClientObservabilityEvent({
      eventType: "frontend_error",
      message: "Failed for patient@example.com",
      error: new Error("Bearer sk_live_secret"),
      requestId: "req-1",
      correlationId: "corr-1",
      route: "/app",
    });

    expect(event.event_type).toBe("frontend_error");
    expect(event.service).toBe("mission-control-frontend");
    expect(event.request_id).toBe("req-1");
    expect(event.correlation_id).toBe("corr-1");
    expect(JSON.stringify(event)).not.toContain("patient@example.com");
    expect(JSON.stringify(event)).not.toContain("sk_live_secret");
  });

  it("adds correlation headers and preserves backend request ID on API errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Headers({ "x-request-id": "backend-req-1" }),
      text: async () => JSON.stringify({ status: "error", message: "Failed" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000001",
    );

    const error = await apiRequest("/api/contacts", { token: "token" }).catch(
      (caught) => caught,
    );

    expect(error).toBeInstanceOf(ApiClientError);
    expect((error as ApiClientError).requestId).toBe("backend-req-1");
    const [, init] = fetchMock.mock.calls[0]!;
    const headers = init.headers as Headers;
    expect(headers.get("x-correlation-id")).toBe(
      "00000000-0000-4000-8000-000000000001",
    );
    expect(headers.get("x-request-id")).toBe(
      "00000000-0000-4000-8000-000000000001",
    );
  });

  it("creates a fallback client correlation ID", () => {
    expect(createClientCorrelationId()).toMatch(/^[a-f0-9-]{36}|client-/);
  });
});
