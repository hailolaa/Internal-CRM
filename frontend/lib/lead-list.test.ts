import { describe, expect, it } from "vitest";
import { mergeLeadRows } from "./lead-list";

describe("mergeLeadRows", () => {
  it("keeps manual leads while preferring deal-backed rows for linked contacts", () => {
    const dealRows = [
      { id: "deal-1", contactId: "contact-1", label: "Pipeline lead" },
    ];
    const contactRows = [
      { id: "contact-1", contactId: "contact-1", label: "Duplicate contact" },
      { id: "contact-2", contactId: "contact-2", label: "Manual lead" },
    ];

    expect(mergeLeadRows(dealRows, contactRows)).toEqual([
      dealRows[0],
      contactRows[1],
    ]);
  });
});
