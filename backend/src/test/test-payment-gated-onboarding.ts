import assert from "node:assert/strict";
import test from "node:test";
import * as clientAccountsModule from "../modules/client-accounts/client-accounts.service.js";

test("paid-package onboarding stays paused until payment is cleared", () => {
  const deriveStatus = (clientAccountsModule as any).derivePaymentGatedOnboardingStatus;

  assert.equal(typeof deriveStatus, "function");
  assert.equal(deriveStatus({ requestedStatus: "in_progress", paymentStatus: "pending", paymentRequired: true }), "paused");
  assert.equal(deriveStatus({ requestedStatus: "in_progress", paymentStatus: "paid", paymentRequired: true }), "in_progress");
  assert.equal(deriveStatus({ requestedStatus: "paused", paymentStatus: "paid", paymentRequired: true }), "in_progress");
  assert.equal(deriveStatus({ requestedStatus: "in_progress", paymentStatus: "not_started", paymentRequired: false }), "in_progress");
  assert.equal(deriveStatus({ requestedStatus: "completed", paymentStatus: "paid", paymentRequired: true }), "completed");
});
