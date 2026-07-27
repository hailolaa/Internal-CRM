import { describe, expect, it } from "vitest";
import {
  isCanonicalWonClientOnboardingTask,
  WON_CLIENT_ONBOARDING_TASK_KEYS,
} from "./won-client-onboarding";

describe("won client onboarding checklist", () => {
  it("counts only the exact 16 canonical tasks and excludes preserved legacy tasks", () => {
    const canonicalTasks = WON_CLIENT_ONBOARDING_TASK_KEYS.map((taskKey) => ({
      category: "client_onboarding",
      templateKey: `won_client_onboarding:deal-123:${taskKey}`,
    }));
    const legacyTasks = ["kickoff", "access", "tracking", "delivery-plan"].map((taskKey) => ({
      category: "client_onboarding",
      templateKey: `won_client_onboarding:deal-123:${taskKey}`,
    }));

    expect([...canonicalTasks, ...legacyTasks].filter(isCanonicalWonClientOnboardingTask)).toHaveLength(16);
    expect(legacyTasks.some(isCanonicalWonClientOnboardingTask)).toBe(false);
  });

  it("rejects malformed and unrelated task keys", () => {
    expect(isCanonicalWonClientOnboardingTask({
      category: "client_onboarding",
      templateKey: "won_client_onboarding::invoice",
    })).toBe(false);
    expect(isCanonicalWonClientOnboardingTask({
      category: "client_onboarding",
      templateKey: "won_client_onboarding:deal-123:invoice:extra",
    })).toBe(false);
    expect(isCanonicalWonClientOnboardingTask({
      category: "general",
      templateKey: "won_client_onboarding:deal-123:invoice",
    })).toBe(false);
  });
});
