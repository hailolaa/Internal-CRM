import { describe, expect, it } from "vitest";

import {
  getDashboardKeyboardTargetIndex,
  getDashboardKpiCards,
} from "./dashboard-cards";

describe("dashboard KPI cards", () => {
  it("opens expected filtered destinations and preserves dashboard context", () => {
    const cards = getDashboardKpiCards({
      newProspects: 4,
      won: 2,
      lost: 1,
      openClients: 5,
      activeProjects: 3,
      overdueTasks: 6,
    });

    expect(cards.map((card) => [card.key, card.href])).toEqual([
      ["newProspects", "/app/leads?view=new&from=dashboard"],
      ["won", "/app/crm/pipeline?status=won&from=dashboard"],
      ["lost", "/app/crm/pipeline?status=lost&from=dashboard"],
      [
        "openClients",
        "/app/ops/client-accounts?contractStatus=open&from=dashboard",
      ],
      ["activeProjects", "/app/ops/services?status=active&from=dashboard"],
      ["overdueTasks", "/app/crm/tasks?due=overdue&from=dashboard"],
    ]);
    expect(cards.every((card) => card.href.includes("from=dashboard"))).toBe(
      true,
    );
  });

  it("exposes count-specific accessible names", () => {
    const cards = getDashboardKpiCards({
      newProspects: 4,
      won: 2,
      lost: 1,
      openClients: 5,
      activeProjects: 3,
      overdueTasks: 6,
    });

    expect(cards.map((card) => card.ariaLabel)).toEqual([
      "Open 4 new prospects in the prospect list",
      "Open 2 won opportunities in the sales pipeline",
      "Open 1 lost opportunities in the sales pipeline",
      "Open 5 open client accounts",
      "Open 3 active delivery projects",
      "Open 6 overdue internal tasks",
    ]);
  });

  it("supports arrow-key, Home and End navigation with wrapping", () => {
    const totalItems = 6;

    expect(
      getDashboardKeyboardTargetIndex({
        currentIndex: 0,
        key: "ArrowRight",
        totalItems,
        columnCount: 2,
      }),
    ).toBe(1);
    expect(
      getDashboardKeyboardTargetIndex({
        currentIndex: 0,
        key: "ArrowLeft",
        totalItems,
        columnCount: 2,
      }),
    ).toBe(5);
    expect(
      getDashboardKeyboardTargetIndex({
        currentIndex: 1,
        key: "ArrowDown",
        totalItems,
        columnCount: 2,
      }),
    ).toBe(3);
    expect(
      getDashboardKeyboardTargetIndex({
        currentIndex: 1,
        key: "ArrowUp",
        totalItems,
        columnCount: 2,
      }),
    ).toBe(5);
    expect(
      getDashboardKeyboardTargetIndex({
        currentIndex: 4,
        key: "Home",
        totalItems,
        columnCount: 2,
      }),
    ).toBe(0);
    expect(
      getDashboardKeyboardTargetIndex({
        currentIndex: 4,
        key: "End",
        totalItems,
        columnCount: 2,
      }),
    ).toBe(5);
    expect(
      getDashboardKeyboardTargetIndex({
        currentIndex: 4,
        key: "Enter",
        totalItems,
        columnCount: 2,
      }),
    ).toBe(4);
  });
});
