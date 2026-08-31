import assert from "node:assert/strict";
import test from "node:test";
import { buildLeadIngestionContract } from "../modules/integration-inputs/lead-ingestion-contract.js";

test("CG-157 lead ingestion contract covers every required channel with safe source states", () => {
  const channels = buildLeadIngestionContract({
    apiKeyCount: 1,
    formCount: 1,
    hasTwilio: true,
    hasTrackingNumber: true,
    hasMeta: false,
    hasGoogle: false,
    hasCalendar: false,
    hasEmailWebhook: true,
  });
  const byChannel = new Map(channels.map((channel) => [channel.channel, channel]));

  assert.deepEqual(
    channels.map((channel) => channel.channel),
    [
      "website_forms",
      "landing_page_forms",
      "chatbot",
      "scheduler_bookings",
      "twilio_calls",
      "twilio_sms",
      "missed_calls",
      "gmail_enquiries",
      "meta_lead_ads",
      "google_ads_lead_forms",
      "manual_entry",
      "fireflies_post_call",
      "whatsapp_business_api",
    ],
  );

  assert.equal(byChannel.get("website_forms")?.status, "ready");
  assert.equal(byChannel.get("landing_page_forms")?.idempotency.includes("idempotencyKey"), true);
  assert.equal(byChannel.get("chatbot")?.identity.includes("chatbot conversation ID"), true);
  assert.equal(byChannel.get("gmail_enquiries")?.status, "ready");
  assert.equal(byChannel.get("meta_lead_ads")?.status, "provider_dependent");
  assert.equal(byChannel.get("google_ads_lead_forms")?.status, "blocked");
  assert.equal(byChannel.get("fireflies_post_call")?.status, "blocked");
  assert.equal(byChannel.get("whatsapp_business_api")?.status, "blocked");

  for (const channel of channels) {
    assert.ok(channel.identity.length > 0, `${channel.channel} must define identity`);
    assert.ok(channel.attribution.length > 0, `${channel.channel} must define attribution`);
    assert.ok(channel.consent.length > 0, `${channel.channel} must define consent`);
    assert.ok(channel.idempotency, `${channel.channel} must define idempotency`);
    assert.ok(channel.replay, `${channel.channel} must define replay behaviour`);
  }
});
