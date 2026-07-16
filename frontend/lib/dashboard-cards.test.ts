import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DashboardReturnLink } from "../components/dashboard-return-link";
import { DashboardKpiCardLink } from "../components/dashboard-kpi-card-link";

import {
  getDashboardKeyboardTargetIndex,
  getDashboardKpiCards,
  isDashboardActiveProjectStatus,
  isDashboardNewProspect,
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
      ["activeProjects", "/app/ops/services?view=active-project&from=dashboard"],
      ["overdueTasks", "/app/crm/tasks?due=overdue&from=dashboard"],
    ]);
    expect(cards.every((card) => card.href.includes("from=dashboard"))).toBe(
      true,
    );
  });

  it("uses the same definitions as the filtered prospect and project destinations", () => {
    const now = new Date("2026-07-16T12:00:00Z");
    expect(isDashboardNewProspect({
      status: "open",
      stageKind: "open",
      stageName: "Qualified",
      createdAt: "2026-07-10T09:00:00Z",
      now,
    })).toBe(true);
    expect(isDashboardNewProspect({
      status: "won",
      stageKind: "won",
      stageName: "Won",
      createdAt: "2026-07-16T09:00:00Z",
      now,
    })).toBe(false);
    expect(isDashboardActiveProjectStatus("active")).toBe(true);
    expect(isDashboardActiveProjectStatus("onboarding")).toBe(true);
    expect(isDashboardActiveProjectStatus("paused")).toBe(false);
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

  it("renders an accessible route back to the dashboard only for dashboard journeys", () => {
    const visibleMarkup = renderToStaticMarkup(
      createElement(DashboardReturnLink, { visible: true }),
    );
    expect(visibleMarkup).toContain('href="/app"');
    expect(visibleMarkup).toContain('aria-label="Back to Mission Control dashboard"');
    expect(visibleMarkup).toContain("Back to Mission Control");
    expect(renderToStaticMarkup(
      createElement(DashboardReturnLink, { visible: false }),
    )).toBe("");
  });

  it("renders KPI cards as keyboard-focusable links with an accessible name", () => {
    const markup = renderToStaticMarkup(
      createElement(
        DashboardKpiCardLink,
        {
          href: "/app/crm/tasks?due=overdue&from=dashboard",
          ariaLabel: "Open 6 overdue internal tasks",
          index: 0,
          activeIndex: 0,
          setActiveIndex: () => undefined,
          registerItemRef: () => undefined,
          totalItems: 6,
        },
        createElement("span", null, "6"),
      ),
    );

    expect(markup).toContain('href="/app/crm/tasks?due=overdue&amp;from=dashboard"');
    expect(markup).toContain('aria-label="Open 6 overdue internal tasks"');
    expect(markup).toContain('tabindex="0"');
    expect(markup).toContain("data-dashboard-kpi-card");
  });
});
