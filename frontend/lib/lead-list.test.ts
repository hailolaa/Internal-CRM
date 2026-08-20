import { describe, expect, it } from "vitest";
import {
  formatLeadListValue,
  leadContactDetailHref,
  mergeLeadRows,
} from "./lead-list";

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

describe("leadContactDetailHref", () => {
  it("creates a distinct detail destination for each contact", () => {
    expect(leadContactDetailHref("contact-1")).toBe(
      "/app/crm/contacts/detail?id=contact-1",
    );
    expect(leadContactDetailHref("contact-2")).toBe(
      "/app/crm/contacts/detail?id=contact-2",
    );
  });

  it("encodes contact ids before putting them in the query string", () => {
    expect(leadContactDetailHref("contact/id?source=lead")).toBe(
      "/app/crm/contacts/detail?id=contact%2Fid%3Fsource%3Dlead",
    );
  });
});

describe("formatLeadListValue", () => {
  it("capitalises source and package values", () => {
    expect(formatLeadListValue("google")).toBe("Google");
    expect(formatLeadListValue("clinic growth package")).toBe(
      "Clinic Growth Package",
    );
  });

  it("makes machine-formatted values readable and preserves acronyms", () => {
    expect(formatLeadListValue("google_ads-campaign")).toBe(
      "Google Ads Campaign",
    );
    expect(formatLeadListValue("SEO package")).toBe("SEO Package");
    expect(formatLeadListValue("-")).toBe("-");
    expect(formatLeadListValue("https://example.com/google-ads")).toBe(
      "https://example.com/google-ads",
    );
  });
});
