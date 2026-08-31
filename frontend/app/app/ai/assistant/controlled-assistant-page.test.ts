import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const pageSource = readFileSync(join(process.cwd(), "app/app/ai/assistant/page.tsx"), "utf8");
const rolesSource = readFileSync(join(process.cwd(), "lib/roles.ts"), "utf8");

function constBlock(name: string) {
  const match = rolesSource.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\] as const;`));
  return match?.[1] || "";
}

describe("controlled assistant page contract", () => {
  it("is permission gated and explains read-only guardrails", () => {
    expect(pageSource).toContain('hasPermission("ai_assistant:use")');
    expect(pageSource).toContain("Ask for read-only Mission Control summaries");
    expect(pageSource).toContain("refuses secrets");
    expect(pageSource).toContain("human approval");
  });

  it("adds the assistant permission only to controlled internal roles", () => {
    expect(rolesSource).toContain('"ai_assistant:use"');
    expect(constBlock("ADMIN_PERMISSIONS")).toContain('"ai_assistant:use"');
    expect(constBlock("DELIVERY_PERMISSIONS")).toContain('"ai_assistant:use"');
    expect(constBlock("SALES_PERMISSIONS")).not.toContain('"ai_assistant:use"');
    expect(constBlock("VIEWER_PERMISSIONS")).not.toContain('"ai_assistant:use"');
  });
});
