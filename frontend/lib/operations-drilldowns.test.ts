import { describe, expect, it } from "vitest";
import {
  countClientAccountsMatchingDrilldown,
  DASHBOARD_DUE_TASKS_HREF,
  getClientAccountPrimaryBlockerHash,
  getClientAccountDrilldownHref,
  getClientAccountDrilldownView,
  isOpenClientAccount,
  isTaskDueByToday,
  matchesClientAccountDrilldown,
} from "./operations-drilldowns";

const openAccount = {
  contractStatus: "active",
  onboardingStatus: "in_progress",
  missingAccessCount: 2,
  missingDocumentCount: 1,
};

describe("operations dashboard drill-downs", () => {
  it("accepts only supported client-account views and builds dashboard links", () => {
    expect(getClientAccountDrilldownView("onboarding")).toBe("onboarding");
    expect(getClientAccountDrilldownView("missing-access")).toBe(
      "missing-access",
    );
    expect(getClientAccountDrilldownView("missing-files")).toBe(
      "missing-files",
    );
    expect(getClientAccountDrilldownView("unknown")).toBeNull();
    expect(getClientAccountDrilldownHref("missing-access")).toBe(
      "/app/ops/client-accounts?view=missing-access&from=dashboard",
    );
  });

  it("uses the same open-account population for every blocker view", () => {
    expect(isOpenClientAccount(openAccount)).toBe(true);
    expect(matchesClientAccountDrilldown(openAccount, "onboarding")).toBe(true);
    expect(matchesClientAccountDrilldown(openAccount, "missing-access")).toBe(
      true,
    );
    expect(matchesClientAccountDrilldown(openAccount, "missing-files")).toBe(
      true,
    );

    const closedAccount = { ...openAccount, contractStatus: "cancelled" };
    expect(isOpenClientAccount(closedAccount)).toBe(false);
    expect(
      matchesClientAccountDrilldown(closedAccount, "missing-access"),
    ).toBe(false);
    expect(
      matchesClientAccountDrilldown(closedAccount, "missing-files"),
    ).toBe(false);
  });

  it("matches only the blocker represented by the selected view", () => {
    const completeAccount = {
      ...openAccount,
      onboardingStatus: "completed",
      missingAccessCount: 0,
      missingDocumentCount: 0,
    };

    expect(
      matchesClientAccountDrilldown(completeAccount, "onboarding"),
    ).toBe(false);
    expect(
      matchesClientAccountDrilldown(completeAccount, "missing-access"),
    ).toBe(false);
    expect(
      matchesClientAccountDrilldown(completeAccount, "missing-files"),
    ).toBe(false);
    expect(matchesClientAccountDrilldown(completeAccount, null)).toBe(true);
  });

  it("counts affected open client accounts rather than missing checklist items", () => {
    const accounts = [
      openAccount,
      {
        ...openAccount,
        missingAccessCount: 8,
        missingDocumentCount: 5,
      },
      {
        ...openAccount,
        contractStatus: "cancelled",
        missingAccessCount: 12,
        missingDocumentCount: 9,
      },
    ];

    expect(
      countClientAccountsMatchingDrilldown(accounts, "missing-access"),
    ).toBe(2);
    expect(
      countClientAccountsMatchingDrilldown(accounts, "missing-files"),
    ).toBe(2);
  });

  it("links a blocker row to the tab for its highest-priority blocker", () => {
    expect(
      getClientAccountPrimaryBlockerHash({
        onboardingStatus: "in_progress",
        missingAccessCount: 2,
        missingDocumentCount: 1,
        openIssueCount: 2,
        overdueIssueCount: 1,
      }),
    ).toBe("#account-issues");
    expect(
      getClientAccountPrimaryBlockerHash({
        onboardingStatus: "in_progress",
        missingAccessCount: 2,
        missingDocumentCount: 1,
      }),
    ).toBe("#account-access-assets");
    expect(
      getClientAccountPrimaryBlockerHash({
        onboardingStatus: "in_progress",
        missingAccessCount: 2,
      }),
    ).toBe("#account-access-assets");
    expect(
      getClientAccountPrimaryBlockerHash({
        onboardingStatus: "in_progress",
        missingDocumentCount: 1,
      }),
    ).toBe("#account-files");
    expect(
      getClientAccountPrimaryBlockerHash({
        onboardingStatus: "completed",
        missingAccessCount: 2,
      }),
    ).toBe("#account-access-assets");
    expect(
      getClientAccountPrimaryBlockerHash({
        onboardingStatus: "completed",
        openIssueCount: 1,
      }),
    ).toBe("#account-issues");
    expect(
      getClientAccountPrimaryBlockerHash({
        onboardingStatus: "in_progress",
      }),
    ).toBe("#account-onboarding");
    expect(
      getClientAccountPrimaryBlockerHash({
        onboardingStatus: "completed",
      }),
    ).toBeNull();
  });

  it("keeps the dashboard task count and due filter on one due-or-overdue contract", () => {
    const now = new Date("2026-07-27T12:00:00Z");

    expect(
      isTaskDueByToday(
        { status: "pending", dueDate: "2026-07-26T09:00:00Z" },
        now,
      ),
    ).toBe(true);
    expect(
      isTaskDueByToday(
        { status: "pending", dueDate: "2026-07-27T18:00:00Z" },
        now,
      ),
    ).toBe(true);
    expect(
      isTaskDueByToday(
        { status: "pending", dueDate: "2026-07-28T09:00:00Z" },
        now,
      ),
    ).toBe(false);
    expect(
      isTaskDueByToday(
        {
          status: "completed",
          dueDate: "2026-07-26T09:00:00Z",
          isOverdue: true,
        },
        now,
      ),
    ).toBe(false);
    expect(
      isTaskDueByToday(
        { status: "pending", dueDate: null, isOverdue: true },
        now,
      ),
    ).toBe(true);
    expect(DASHBOARD_DUE_TASKS_HREF).toBe(
      "/app/crm/tasks?due=due&from=dashboard",
    );
  });
});
