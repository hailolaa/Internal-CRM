import { describe, expect, it } from "vitest";
import { toCsvCell } from "./export-utils";

describe("CSV export cells", () => {
  it("neutralizes spreadsheet formulas in user-controlled strings", () => {
    expect(toCsvCell("=HYPERLINK(\"https://example.test\")")).toBe(
      "\"'=HYPERLINK(\"\"https://example.test\"\")\"",
    );
    expect(toCsvCell("  +SUM(1,2)")).toBe("\"'  +SUM(1,2)\"");
    expect(toCsvCell("@malicious")).toBe("'@malicious");
    expect(toCsvCell("\t=1+1")).toBe("'\t=1+1");
  });

  it("preserves numeric values and applies normal CSV quoting", () => {
    expect(toCsvCell(-5)).toBe("-5");
    expect(toCsvCell("Clinic, Ltd")).toBe("\"Clinic, Ltd\"");
    expect(toCsvCell("Safe clinic")).toBe("Safe clinic");
  });
});
