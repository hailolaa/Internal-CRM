import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const redirects = {
  "app/app/patients/page.tsx": "/app/crm/contacts",
  "app/app/consults/page.tsx": "/app/crm/pipeline",
  "app/app/treatment-plans/page.tsx": "/app/ops/delivery",
  "app/app/settings/treatments/page.tsx": "/app/crm/pipeline/settings",
} as const;

describe("legacy clinic-facing route isolation", () => {
  for (const [file, destination] of Object.entries(redirects)) {
    it(`${file} redirects into the internal Mission Control workspace`, () => {
      const source = readFileSync(resolve(process.cwd(), file), "utf8");
      expect(source).toContain(`redirect("${destination}")`);
    });
  }
});
