import assert from "node:assert/strict";
import test from "node:test";
import { csvCell } from "../utils/csv.js";

test("CSV cells neutralize spreadsheet formulas without changing numbers", () => {
  assert.equal(
    csvCell("=HYPERLINK(\"https://example.test\")"),
    "\"'=HYPERLINK(\"\"https://example.test\"\")\"",
  );
  assert.equal(csvCell("  +SUM(1,2)"), "\"'  +SUM(1,2)\"");
  assert.equal(csvCell("@malicious"), "'@malicious");
  assert.equal(csvCell("\t=1+1"), "'\t=1+1");
  assert.equal(csvCell(-5), "-5");
  assert.equal(csvCell("Clinic, Ltd"), "\"Clinic, Ltd\"");
  assert.equal(csvCell("Safe clinic"), "Safe clinic");
});
