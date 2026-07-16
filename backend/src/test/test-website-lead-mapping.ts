import assert from "node:assert/strict";
import test from "node:test";
import { buildGuideDownloadContext, mapWebsiteLeadIntent } from "../modules/website-leads/website-leads.service.js";

test("Clinic Growth Score form maps to Growth Score free audit", () => {
  const result = mapWebsiteLeadIntent({
    formName: "Clinic Growth Score form",
    ctaClicked: "Get my free audit",
  });

  assert.equal(result.source, "website_growth_score_form");
  assert.equal(result.leadType, "free_audit");
  assert.equal(result.packageInterest, "Clinic Growth Score");
});

test("free guide download maps to lead magnet nurture", () => {
  const result = mapWebsiteLeadIntent({
    guideName: "Free guide: 7 ways to increase enquiries",
    formName: "Guide download",
  });

  assert.equal(result.source, "website_lead_magnet");
  assert.equal(result.leadType, "lead_magnet_nurture");
  assert.equal(result.packageInterest, null);
});

test("free guide download stores guide title, download time, and Growth Score next action", () => {
  const context = buildGuideDownloadContext({
    guideTitle: "Clinic Growth Guide",
    downloadedAt: "2026-07-16T10:30:00.000Z",
  });

  assert.equal(context.guideName, "Clinic Growth Guide");
  assert.equal(context.downloadedAt, "2026-07-16T10:30:00.000Z");
  assert.equal(context.nextAction, "Request/calculate Clinic Growth Score");
});

test("website package CTAs map to the correct package interests", () => {
  const cases = [
    ["Book Growth Diagnostic", "Growth Diagnostic", "website_growth_diagnostic_cta", "package_interest"],
    ["Talk to us about Lead Concierge", "Lead Concierge", "website_lead_concierge_cta", "package_interest"],
    ["Book a Performance OS demo", "Performance OS", "website_performance_os_demo", "demo_request"],
    ["Scale with Growth Engine", "Growth Engine", "website_growth_engine_cta", "package_interest"],
    ["Become the Market Leader", "Market Leader", "website_market_leader_cta", "package_interest"],
  ] as const;

  for (const [ctaClicked, packageInterest, source, leadType] of cases) {
    const result = mapWebsiteLeadIntent({ ctaClicked });
    assert.equal(result.source, source);
    assert.equal(result.leadType, leadType);
    assert.equal(result.packageInterest, packageInterest);
  }
});

test("contact form and manual referral sources are supported", () => {
  const contact = mapWebsiteLeadIntent({ formName: "Contact form" });
  assert.equal(contact.source, "website_contact_form");
  assert.equal(contact.leadType, "contact_enquiry");

  const manual = mapWebsiteLeadIntent({ source: "manual phone lead" });
  assert.equal(manual.source, "manual phone lead");
  assert.equal(manual.leadType, "manual");

  const referral = mapWebsiteLeadIntent({ source: "Partner referral" });
  assert.equal(referral.source, "referral");
  assert.equal(referral.leadType, "referral");
});
