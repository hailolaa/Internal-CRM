import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const pageSource = readFileSync(join(process.cwd(), "app/app/ops/client-accounts/page.tsx"), "utf8");

describe("client account location drill-down", () => {
  it("hydrates search from the dashboard query string and searches location fields", () => {
    expect(pageSource).toContain('const requestedSearch = searchParams.get("search") || ""');
    expect(pageSource).toContain("useState(requestedSearch)");
    expect(pageSource).toContain("account.address || \"\"");
    expect(pageSource).toContain("account.city || \"\"");
    expect(pageSource).toContain("account.country || \"\"");
  });
});
