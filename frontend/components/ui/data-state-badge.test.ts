import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DataStateBadge } from "./data-state-badge";
import { getDataStatePresentation } from "@/lib/data-state";

describe("DataStateBadge", () => {
  it("renders demo state as an unmistakable visible label", () => {
    const html = renderToStaticMarkup(
      createElement(DataStateBadge, {
        state: "demo",
        label: "FICTIONAL DEMO - not production client data",
      }),
    );

    expect(html).toContain("data-data-state=\"demo\"");
    expect(html).toContain("Demo");
    expect(html).toContain("FICTIONAL DEMO - not production client data");
  });

  it("renders roadmap state without implying live data", () => {
    const presentation = getDataStatePresentation("roadmap");
    const html = renderToStaticMarkup(createElement(DataStateBadge, { state: "roadmap" }));

    expect(presentation.label).toBe("Roadmap");
    expect(presentation.description).toBe("Roadmap capability, not live operational data");
    expect(html).toContain("data-data-state=\"roadmap\"");
    expect(html).toContain("Roadmap");
  });

  it("falls back invalid states to live rather than inventing a state", () => {
    const presentation = getDataStatePresentation("unknown-state");
    const html = renderToStaticMarkup(
      createElement(DataStateBadge, { state: "unknown-state", compact: true }),
    );

    expect(presentation.label).toBe("Live");
    expect(html).toContain("data-data-state=\"live\"");
    expect(html).toContain("Live");
  });
});
