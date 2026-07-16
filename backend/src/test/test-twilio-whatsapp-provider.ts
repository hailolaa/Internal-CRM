import assert from "node:assert/strict";
import test from "node:test";
import twilio from "twilio";
import {
  sendTwilioWhatsAppMessage,
  toTwilioWhatsAppAddress,
  validateTwilioWhatsAppRequest,
} from "../modules/comms/twilio-whatsapp.provider.js";

test("Twilio WhatsApp addresses use the required channel prefix and E.164 marker", () => {
  assert.equal(toTwilioWhatsAppAddress("447700900123"), "whatsapp:+447700900123");
  assert.equal(toTwilioWhatsAppAddress("+447700900123"), "whatsapp:+447700900123");
  assert.equal(toTwilioWhatsAppAddress("whatsapp:+447700900123"), "whatsapp:+447700900123");
});

test("Twilio WhatsApp webhook signatures are validated against the exact URL and form parameters", () => {
  const authToken = "test-auth-token";
  const url = "https://crm.clinicgrower.co.uk/api/webhooks/whatsapp/inbound";
  const params = {
    AccountSid: "AC11111111111111111111111111111111",
    MessageSid: "SM11111111111111111111111111111111",
    From: "whatsapp:+447700900123",
    To: "whatsapp:+447700900456",
    Body: "Hello",
  };
  const signature = twilio.getExpectedTwilioSignature(authToken, url, params);
  assert.equal(validateTwilioWhatsAppRequest({ authToken, signature, url, params }), true);
  assert.equal(validateTwilioWhatsAppRequest({ authToken, signature, url: `${url}/wrong`, params }), false);
  assert.equal(validateTwilioWhatsAppRequest({ authToken, signature: "invalid", url, params }), false);
});

test("Twilio WhatsApp outbound messages use the Messages API with form-encoded channel addresses", async () => {
  const originalFetch = globalThis.fetch;
  let request: { url: string; init: RequestInit | undefined } | null = null;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    request = { url: String(url), init };
    return new Response(JSON.stringify({ sid: "SM22222222222222222222222222222222", status: "queued" }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const result = await sendTwilioWhatsAppMessage({
      accountSid: "AC22222222222222222222222222222222",
      authToken: "secret-token",
      from: "+447700900456",
      to: "447700900123",
      body: "Thanks for messaging us.",
      timeoutMs: 1000,
    });
    assert.equal(result.providerMessageId, "SM22222222222222222222222222222222");
    assert.ok(request);
    const captured = request as { url: string; init: RequestInit | undefined };
    assert.equal(captured.url, "https://api.twilio.com/2010-04-01/Accounts/AC22222222222222222222222222222222/Messages.json");
    assert.equal(captured.init?.method, "POST");
    const body = captured.init?.body as URLSearchParams;
    assert.equal(body.get("From"), "whatsapp:+447700900456");
    assert.equal(body.get("To"), "whatsapp:+447700900123");
    assert.equal(body.get("Body"), "Thanks for messaging us.");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
