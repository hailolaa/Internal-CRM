import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const financePolicy = readFileSync(
  new URL("../docs/accounting-mrr-profitability-rules.md", import.meta.url),
  "utf8",
);

const healthPolicy = readFileSync(
  new URL("../docs/client-health-churn-renewal-support-sla-rules.md", import.meta.url),
  "utf8",
);

test("CG-131 finance policy defines required mappings and keeps provider generic", () => {
  for (const expected of [
    "Client account profile",
    "Accepted service agreement",
    "Active package/service",
    "VAT/tax treatment",
    "Recurring monthly invoice",
    "One-off setup/diagnostic",
    "Payment receipt",
    "Part payment",
    "Credit/refund",
    "Supplier/freelancer/software cost",
  ]) {
    assert.match(financePolicy, new RegExp(expected.replace(/[\/]/g, "\\/")));
  }

  assert.match(financePolicy, /approved accounting platform is the authority/);
  assert.match(financePolicy, /Provider-specific naming stays generic/);
  assert.doesNotMatch(financePolicy, /QuickBooks/);
});

test("CG-131 finance policy defines MRR, profitability, revenue risk and approvals", () => {
  for (const expected of [
    "MRR is the recurring monthly service value",
    "excluding VAT, advertising/media spend, deposits, diagnostics",
    "One-off revenue is tracked separately from MRR",
    "`new`: previous MRR is zero",
    "`expansion`: current MRR is greater",
    "`contraction`: current MRR is lower",
    "`churn`: previous MRR is above zero",
    "Client gross margin is `recognised revenue - direct costs`",
    "Revenue at risk combines current MRR",
    "new customer creation or customer merge",
    "invoice send",
    "credit note",
    "refund",
    "bank account, mandate or payment-method change",
  ]) {
    assert.match(financePolicy, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("CG-131 reconciliation rules protect identity, tenants and accounting truth", () => {
  assert.match(financePolicy, /provider customer\/invoice\/payment ID plus Mission Control/);
  assert.match(financePolicy, /Name-only matching is warning-only/);
  assert.match(financePolicy, /Cross-client or cross-tenant matches are blocked/);
  assert.match(financePolicy, /Duplicate provider events are processed idempotently/);
  assert.match(financePolicy, /must not overwrite\s+accounting-platform truth/);
});

test("CG-132 health policy defines weighted RAG model and minimum data handling", () => {
  const weights = [...healthPolicy.matchAll(/\|\s[^|\n]+\|\s(\d+)\s\|/g)].map((match) => Number(match[1]));
  assert.equal(weights.reduce((sum, value) => sum + value, 0), 100);

  for (const expected of [
    "Performance vs agreed goal",
    "Data/tracking health",
    "Delivery and QA",
    "Lead handling and conversion",
    "Communication and sentiment",
    "Complaints and incidents",
    "Invoice/payment state",
    "Contract and notice risk",
    "Last meaningful contact",
  ]) {
    assert.match(healthPolicy, new RegExp(expected));
  }

  assert.match(healthPolicy, /missing source is listed as a reason code/);
  assert.match(healthPolicy, /Provider-dependent data must show the provider\/state label/);
});

test("CG-132 health policy defines thresholds, reason codes, SLA and alert rules", () => {
  for (const expected of [
    "Green",
    "Amber",
    "Red",
    "performance_below_goal",
    "tracking_missing",
    "delivery_qa_failed",
    "lead_response_sla_slipping",
    "complaint_open",
    "invoice_overdue",
    "notice_window_open",
    "P1 critical",
    "P2 high",
    "P3 normal",
    "P4 low",
    "Duplicate alerts are prevented",
    "Closure requires verified recovery evidence",
  ]) {
    assert.match(healthPolicy, new RegExp(expected));
  }
});

test("CG-132 policy keeps manual override and downstream boundaries explicit", () => {
  assert.match(healthPolicy, /Override must record previous health state/);
  assert.match(healthPolicy, /Override does not delete underlying source reasons/);
  assert.match(healthPolicy, /CG-132 defines the policy/);
  assert.match(healthPolicy, /CG-136 implements the calculated health\/churn\/upsell engine/);
  assert.match(healthPolicy, /CG-160 supplies canonical client identity/);
  assert.match(healthPolicy, /CG-079 supplies sync-health/);
});

test("policy documents do not contain secret-looking material", () => {
  for (const content of [financePolicy, healthPolicy]) {
    assert.doesNotMatch(content, /sk_live|sk_test|xox[baprs]-|ghp_|AIza|-----BEGIN PRIVATE KEY-----/);
    assert.doesNotMatch(content, /password\s*[:=]\s*[^`\s]/i);
    assert.doesNotMatch(content, /token\s*[:=]\s*[^`\s]/i);
  }
});
