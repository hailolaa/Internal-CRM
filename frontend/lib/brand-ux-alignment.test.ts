import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(path, "utf8");
}

describe("ClinicGrower brand and UX alignment", () => {
  it("keeps shared brand assets, fonts and tokens referenced", () => {
    const logo = read("components/brand/ClinicGrowerLogo.tsx");
    const layout = read("app/layout.tsx");
    const globals = read("app/globals.css");
    const tokens = read("styles/tokens.css");
    const docs = read("../docs/brand-ux-alignment.md");

    expect(logo).toContain("/brand/clinic-grower-logo-inline.png");
    expect(logo).toContain("/brand/clinic-grower-icon-light-circular.png");
    expect(layout).toContain("Inter");
    expect(layout).toContain("Plus_Jakarta_Sans");
    expect(globals).toContain('@import "../styles/tokens.css"');
    expect(tokens).toContain("--color-primary: #151f21");
    expect(tokens).toContain("--color-accent: #60b4af");
    expect(tokens).toContain("--color-teal-muted: #5e8a8d");
    expect(docs).toContain("ClinicGrower Mission Control");
    expect(docs).toContain("Clinic OS");
    expect(docs).toContain("analytics");
  });
});
