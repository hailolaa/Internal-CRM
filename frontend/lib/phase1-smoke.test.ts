import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api-client/core";
import { getRoleLabel } from "@/lib/roles";
import {
  benchmarkHasSafeLowDataWording,
  benchmarkUsesEstimatedInternalWording,
  pipelineHasRequiredStageLabels,
  reputationUsesManualFallback,
  replySuggestionIsAdvisory,
} from "@/lib/phase1-smoke";
import type { BenchmarkSummaryRecord, ReputationSummaryRecord } from "@/lib/api-types";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Phase 1 frontend smoke coverage", () => {
  it("constructs authenticated API requests with normalized /api paths", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ status: "success", data: { ok: true } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest("/api/benchmarks/summary", {
      token: "test-token",
      method: "POST",
      body: JSON.stringify({ ping: true }),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("http://localhost:3000/benchmarks/summary");
    expect(init.method).toBe("POST");
    expect(init.cache).toBe("no-store");
    expect(init.headers.get("Authorization")).toBe("Bearer test-token");
    expect(init.headers.get("Content-Type")).toBe("application/json");
    expect(init.headers.get("Accept")).toBe("application/json");
  });

  it("recognises low-data estimated benchmark wording", () => {
    const summary: BenchmarkSummaryRecord = {
      clinicId: "clinic-1",
      counts: { leads: 4, calls: 2, consults: 1 },
      minimumThresholds: { leads: 30, calls: 20, consults: 10 },
      cohortStatus: "internal_comparison_until_wider_cohort_data_is_available",
      safeWording: "Estimated benchmark. Based on available data.",
      metrics: [
        {
          key: "booking_rate",
          label: "Booking rate benchmark",
          value: 25,
          unit: "percent",
          benchmarkAverage: 32,
          topQuartile: 45,
          gapToAverage: -7,
          enoughData: false,
          minimumThreshold: 30,
          currentCount: 4,
          wording: "Not enough data yet. Internal comparison until wider cohort data is available.",
          benchmarkSource: "estimated",
        },
      ],
    };

    expect(benchmarkHasSafeLowDataWording(summary)).toBe(true);
    expect(benchmarkUsesEstimatedInternalWording(summary)).toBe(true);
  });

  it("recognises manual reputation and fallback reply states", () => {
    const summary: ReputationSummaryRecord = {
      googleReviewLink: "https://g.page/r/demo/review",
      reviewRequestTemplate: "Hi {{client_name}}, please review us.",
      manualReviewReceivedCount: 42,
      reviewRequestsSentCount: 3,
      reviewRequestsTotalCount: 4,
      googleReviewSyncConnected: false,
      wording: [
        "Manual review count",
        "Google review sync is not connected",
        "Based on manually entered data",
      ],
      checklist: [],
    };

    expect(reputationUsesManualFallback(summary)).toBe(true);
    expect(replySuggestionIsAdvisory({
      advisory: true,
      source: "fallback",
      suggestion: "Thank you for your feedback.",
    })).toBe(true);
  });

  it("maps Phase 1 role labels", () => {
    expect(getRoleLabel("ADMIN")).toBe("Admin");
    expect(getRoleLabel("SALES")).toBe("Sales");
    expect(getRoleLabel("RECEPTIONIST")).toBe("Sales");
    expect(getRoleLabel("PRACTITIONER")).toBe("Delivery / Team Member");
    expect(getRoleLabel("FINANCE")).toBe("Finance");
    expect(getRoleLabel("READ_ONLY")).toBe("Internal Viewer");
    expect(getRoleLabel("SUPER_ADMIN")).toBe("Super Admin");
  });

  it("requires the Phase 1 pipeline stage labels", () => {
    expect(pipelineHasRequiredStageLabels([
      "New Lead",
      "Contact Needed",
      "Contact Attempted",
      "Spoken To",
      "Free Audit Needed",
      "Free Audit In Progress",
      "Audit Complete",
      "Dashboard Access Given",
      "Proposal Needed",
      "Proposal Sent",
      "Follow-up Needed",
      "Negotiation",
      "Won",
      "Lost",
      "Nurture",
      "Future Opportunity",
    ])).toBe(true);
  });
});
