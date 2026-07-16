import twilio from "twilio";
import { ApiError } from "../../utils/ApiError.js";

export function toTwilioWhatsAppAddress(value: string) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  const address = normalized.toLowerCase().startsWith("whatsapp:")
    ? normalized.slice("whatsapp:".length).trim()
    : normalized;
  const phone = address.startsWith("+") ? `+${address.slice(1).replace(/\D/g, "")}` : `+${address.replace(/\D/g, "")}`;
  return `whatsapp:${phone}`;
}

export function validateTwilioWhatsAppRequest(input: {
  authToken: string;
  signature: string;
  url: string;
  params: Record<string, unknown>;
}) {
  const params = Object.fromEntries(
    Object.entries(input.params).map(([key, value]) => [key, Array.isArray(value) ? value.map(String) : String(value ?? "")]),
  );
  return twilio.validateRequest(input.authToken, input.signature, input.url, params);
}

export async function sendTwilioWhatsAppMessage(input: {
  accountSid: string;
  authToken: string;
  from: string;
  to: string;
  body: string;
  timeoutMs: number;
}) {
  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(input.accountSid)}/Messages.json`;
  const response = await fetch(endpoint, {
    method: "POST",
    signal: AbortSignal.timeout(input.timeoutMs),
    headers: {
      Authorization: `Basic ${Buffer.from(`${input.accountSid}:${input.authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      From: toTwilioWhatsAppAddress(input.from),
      To: toTwilioWhatsAppAddress(input.to),
      Body: input.body,
    }),
  });
  const payload: any = await response.json().catch(() => ({}));
  if (!response.ok || !payload.sid) {
    throw ApiError.serviceUnavailable(
      payload.message || payload.error_message || `Twilio WhatsApp failed with ${response.status}`,
    );
  }
  return {
    providerMessageId: String(payload.sid),
    providerResponse: {
      provider: "twilio",
      sid: String(payload.sid),
      status: payload.status || "queued",
      errorCode: payload.error_code || null,
    },
  };
}
