import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import app from "../app.js";
import pool, { testConnection } from "../config/database.js";
import { config } from "../config/index.js";
import { authService } from "../modules/auth/auth.service.js";
import { v4 as uuidv4 } from "uuid";

function uniqueEmail(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}@test.com`;
}

async function createClinicAndAdmin(prefix: string) {
  const result = await authService.registerClinic({
    clinicName: `${prefix} Clinic`,
    adminEmail: uniqueEmail(`${prefix}_admin`),
    adminPassword: "password123",
    firstName: prefix,
    lastName: "Admin",
    phone: "555-0100",
  });

  return {
    clinicId: result.user.clinicId,
    userId: result.user.id,
    token: result.tokens.token,
  };
}

async function fetchJson(baseUrl: string, path: string, token: string, init: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });
  const body: any = await response.json();
  return { response, body };
}

test("phase 1 final verification routes cover benchmarks, reputation reads, and Twilio secret rejection", async () => {
  await testConnection();

  const primary = await createClinicAndAdmin("PhaseOneVerifyPrimary");
  const secondary = await createClinicAndAdmin("PhaseOneVerifySecondary");

  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start phase 1 verification test server");
  }
  const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;
  const originalTwilioSecret = config.twilio.webhookSecret;

  try {
    const benchmark = await fetchJson(baseUrl, "/api/benchmarks/summary", primary.token);
    assert.equal(benchmark.response.status, 200);
    const bookingRate = benchmark.body.data.metrics.find((metric: any) => metric.key === "booking_rate");
    assert.ok(bookingRate, "Expected booking_rate benchmark metric");
    assert.equal(bookingRate.enoughData, false);
    assert.equal(String(bookingRate.wording).includes("Not enough data yet"), true);

    const summary = await fetchJson(baseUrl, "/api/reviews/summary", primary.token);
    assert.equal(summary.response.status, 200);
    assert.equal(summary.body.data.googleReviewSyncConnected, false);
    assert.equal(Array.isArray(summary.body.data.checklist), true);

    const settings = await fetchJson(baseUrl, "/api/reviews/settings", primary.token, {
      method: "PATCH",
      body: JSON.stringify({
        googleReviewLink: "https://g.page/r/phase-one/review",
        reviewRequestTemplate: "Hi {{patient_name}}, please review us: {{google_review_link}}",
        manualReviewReceivedCount: 12,
      }),
    });
    assert.equal(settings.response.status, 200);
    assert.equal(settings.body.data.manualReviewReceivedCount, 12);

    const settingsRead = await fetchJson(baseUrl, "/api/reviews/settings", primary.token);
    assert.equal(settingsRead.response.status, 200);
    assert.equal(settingsRead.body.data.googleReviewLink, "https://g.page/r/phase-one/review");
    assert.equal(settingsRead.body.data.googleReviewManagementUrl, "https://g.page/r/phase-one/review");
    assert.equal(settingsRead.body.data.reviewRequestTemplate.includes("{{google_review_link}}"), true);

    const reviewContactId = uuidv4();
    const reviewId = uuidv4();
    await pool.execute(
      `INSERT INTO contact (id, clinic_id, first_name, last_name, email, phone)
       VALUES (?, ?, 'Review', 'Patient', ?, '+15554500004')`,
      [reviewContactId, primary.clinicId, uniqueEmail("phase1_review_contact")],
    );
    await pool.execute(
      `INSERT INTO review (id, clinic_id, contact_id, rating, comment, source, status)
       VALUES (?, ?, ?, 5, 'Great care.', 'google', 'new')`,
      [reviewId, primary.clinicId, reviewContactId],
    );

    const handoff = await fetchJson(baseUrl, `/api/reviews/${reviewId}/reply-handoff`, primary.token, {
      method: "POST",
    });
    assert.equal(handoff.response.status, 200);
    assert.equal(handoff.body.data.action, "open_external");
    assert.equal(handoff.body.data.directReplyAvailable, false);
    assert.equal(handoff.body.data.externalUrl, "https://g.page/r/phase-one/review");

    const createdRequest = await fetchJson(baseUrl, "/api/reviews/requests", primary.token, {
      method: "POST",
      body: JSON.stringify({
        recipientName: "Route Verified",
        recipientPhone: "+1 (555) 450-0001",
        recipientEmail: uniqueEmail("phase1_review_request"),
        message: "Thanks for visiting. Could you leave us a review?",
      }),
    });
    assert.equal(createdRequest.response.status, 201);
    const requestId = createdRequest.body.data.id;
    assert.ok(requestId);

    const markSent = await fetchJson(baseUrl, `/api/reviews/requests/${requestId}/sent`, primary.token, {
      method: "POST",
    });
    assert.equal(markSent.response.status, 200);

    const requestList = await fetchJson(baseUrl, "/api/reviews/requests", primary.token);
    assert.equal(requestList.response.status, 200);
    const listedRequest = requestList.body.data.find((item: any) => item.id === requestId);
    assert.ok(listedRequest, "Expected created review request in list");
    assert.equal(listedRequest.status, "sent");
    assert.ok(listedRequest.sentAt);

    const secondaryRequestList = await fetchJson(baseUrl, "/api/reviews/requests", secondary.token);
    assert.equal(secondaryRequestList.response.status, 200);
    assert.equal(secondaryRequestList.body.data.some((item: any) => item.id === requestId), false);

    const replySuggestion = await fetchJson(baseUrl, "/api/reviews/reply-suggestion", primary.token, {
      method: "POST",
      body: JSON.stringify({ rating: 2, comment: "I waited too long." }),
    });
    assert.equal(replySuggestion.response.status, 200);
    assert.equal(replySuggestion.body.data.advisory, true);
    assert.equal(replySuggestion.body.data.source, "fallback");

    (config.twilio as any).webhookSecret = "phase-one-secret";
    const rejectedTwilio = await fetch(`${baseUrl}/api/webhooks/twilio/calls?secret=wrong`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ CallSid: "CAphaseoneverification", From: "+15554500001", To: "+15554500002" }),
    });
    assert.equal(rejectedTwilio.status, 401);
  } finally {
    (config.twilio as any).webhookSecret = originalTwilioSecret;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
    await pool.end();
  }
});
