"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

// ============================================================
// Webhook Ingestion — mock webhook receiver + log
// Production: POST /webhooks/leads, /webhooks/twilio/calls, /webhooks/stripe
// ============================================================

export type WebhookSource =
  | "google_ads"
  | "meta_ads"
  | "twilio"
  | "stripe"
  | "website_form"
  | "custom";
export type WebhookStatus = "received" | "processed" | "failed" | "pending";

export interface WebhookEvent {
  id: string;
  source: WebhookSource;
  endpoint: string;
  method: "POST";
  status: WebhookStatus;
  statusCode: number;
  payload: Record<string, unknown>;
  headers: Record<string, string>;
  signatureValid: boolean;
  processingTimeMs: number;
  createdEntity: string | null;
  error: string | null;
  clinicId: string;
  timestamp: string;
  relativeTime: string;
}

interface WebhookContextValue {
  events: WebhookEvent[];
  simulateWebhook: (
    source: WebhookSource,
    payload: Record<string, unknown>,
  ) => WebhookEvent;
  clearEvents: () => void;
  endpointConfig: WebhookEndpoint[];
}

export interface WebhookEndpoint {
  path: string;
  source: WebhookSource;
  description: string;
  signatureHeader: string;
  status: "active" | "inactive";
  eventsReceived: number;
  lastReceived: string;
}

const ENDPOINTS: WebhookEndpoint[] = [
  {
    path: "/webhooks/leads",
    source: "google_ads",
    description: "Inbound leads from Google Ads, Meta Ads, and website forms",
    signatureHeader: "X-Webhook-Signature",
    status: "active",
    eventsReceived: 234,
    lastReceived: "3 min ago",
  },
  {
    path: "/webhooks/twilio/calls",
    source: "twilio",
    description:
      "Twilio call status callbacks (connected, completed, no-answer)",
    signatureHeader: "X-Twilio-Signature",
    status: "active",
    eventsReceived: 567,
    lastReceived: "12 min ago",
  },
  {
    path: "/webhooks/stripe",
    source: "stripe",
    description:
      "Stripe payment events (payment_intent.succeeded, invoice.paid)",
    signatureHeader: "Stripe-Signature",
    status: "active",
    eventsReceived: 89,
    lastReceived: "1 hour ago",
  },
];

const SEED_EVENTS: WebhookEvent[] = [
  {
    id: "wh_001",
    source: "google_ads",
    endpoint: "/webhooks/leads",
    method: "POST",
    status: "processed",
    statusCode: 200,
    payload: {
      lead_id: "gads_12345",
      name: "Jessica Williams",
      email: "jessica@email.com",
      phone: "07700 900999",
      campaign: "Spring Botox Promo",
      treatment: "Botox",
    },
    headers: {
      "Content-Type": "application/json",
      "X-Webhook-Signature": "sha256=abc123...",
    },
    signatureValid: true,
    processingTimeMs: 45,
    createdEntity: "contact:c_123",
    error: null,
    clinicId: "clinic_001",
    timestamp: "2026-05-05T09:12:00Z",
    relativeTime: "3 min ago",
  },
  {
    id: "wh_002",
    source: "twilio",
    endpoint: "/webhooks/twilio/calls",
    method: "POST",
    status: "processed",
    statusCode: 200,
    payload: {
      CallSid: "CA_abc123",
      CallStatus: "completed",
      From: "+447700900123",
      To: "+442071234567",
      Duration: "247",
      RecordingUrl: "https://api.twilio.com/recordings/RE_xyz",
    },
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Twilio-Signature": "twilio_sig_xyz",
    },
    signatureValid: true,
    processingTimeMs: 32,
    createdEntity: "call:call_789",
    error: null,
    clinicId: "clinic_001",
    timestamp: "2026-05-05T08:45:00Z",
    relativeTime: "30 min ago",
  },
  {
    id: "wh_003",
    source: "stripe",
    endpoint: "/webhooks/stripe",
    method: "POST",
    status: "processed",
    statusCode: 200,
    payload: {
      id: "evt_1234",
      type: "payment_intent.succeeded",
      data: {
        object: {
          amount: 35000,
          currency: "gbp",
          customer: "cus_abc",
          description: "Deposit — Full Face Rejuvenation",
        },
      },
    },
    headers: {
      "Content-Type": "application/json",
      "Stripe-Signature": "t=123,v1=abc...",
    },
    signatureValid: true,
    processingTimeMs: 67,
    createdEntity: "payment:pay_001",
    error: null,
    clinicId: "clinic_001",
    timestamp: "2026-05-05T08:15:00Z",
    relativeTime: "1 hour ago",
  },
  {
    id: "wh_004",
    source: "meta_ads",
    endpoint: "/webhooks/leads",
    method: "POST",
    status: "processed",
    statusCode: 200,
    payload: {
      lead_id: "meta_67890",
      name: "Amelia Carter",
      email: "amelia@email.com",
      phone: "07700 900888",
      campaign: "Lip Filler Feb",
      treatment: "Lip Filler",
    },
    headers: {
      "Content-Type": "application/json",
      "X-Webhook-Signature": "sha256=def456...",
    },
    signatureValid: true,
    processingTimeMs: 38,
    createdEntity: "contact:c_456",
    error: null,
    clinicId: "clinic_001",
    timestamp: "2026-05-05T07:30:00Z",
    relativeTime: "2 hours ago",
  },
  {
    id: "wh_005",
    source: "website_form",
    endpoint: "/webhooks/leads",
    method: "POST",
    status: "failed",
    statusCode: 422,
    payload: { name: "Test", email: "invalid-email", phone: "", treatment: "" },
    headers: { "Content-Type": "application/json" },
    signatureValid: false,
    processingTimeMs: 12,
    createdEntity: null,
    error: "Validation failed: email format invalid, treatment required",
    clinicId: "clinic_001",
    timestamp: "2026-05-05T07:00:00Z",
    relativeTime: "2 hours ago",
  },
];

let webhookCounter = 100;

export function WebhookProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<WebhookEvent[]>(SEED_EVENTS);

  const simulateWebhook = useCallback(
    (source: WebhookSource, payload: Record<string, unknown>): WebhookEvent => {
      const endpoint =
        source === "twilio"
          ? "/webhooks/twilio/calls"
          : source === "stripe"
            ? "/webhooks/stripe"
            : "/webhooks/leads";
      const isValid =
        !!payload.email || source === "twilio" || source === "stripe";
      const event: WebhookEvent = {
        id: `wh_${++webhookCounter}`,
        source,
        endpoint,
        method: "POST",
        status: isValid ? "processed" : "failed",
        statusCode: isValid ? 200 : 422,
        payload,
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": `sha256=${btoa(String(Date.now()))}`,
        },
        signatureValid: isValid,
        processingTimeMs: Math.floor(Math.random() * 80) + 15,
        createdEntity: isValid ? `contact:c_${webhookCounter}` : null,
        error: isValid ? null : "Validation failed",
        clinicId: "clinic_001",
        timestamp: new Date().toISOString(),
        relativeTime: "Just now",
      };
      setEvents((prev) => [event, ...prev].slice(0, 200));
      return event;
    },
    [],
  );

  const clearEvents = useCallback(() => setEvents(SEED_EVENTS), []);

  return (
    <WebhookContext.Provider
      value={{
        events,
        simulateWebhook,
        clearEvents,
        endpointConfig: ENDPOINTS,
      }}
    >
      {children}
    </WebhookContext.Provider>
  );
}

const WebhookContext = createContext<WebhookContextValue | null>(null);

export function useWebhooks() {
  const ctx = useContext(WebhookContext);
  if (!ctx) throw new Error("useWebhooks must be used within WebhookProvider");
  return ctx;
}
