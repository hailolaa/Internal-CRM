import { config } from "../config/index.js";
import type { CallBookingIntent, CallSentiment } from "../modules/calls/calls.types.js";
import logger from "../utils/logger.js";

export interface CallIntelligenceInput {
  contactName: string;
  direction: string;
  duration: number;
  outcome: string | null;
  notes: string;
  source: string;
  transcript: string;
}

export interface CallIntelligenceFields {
  aiSummary: string;
  bookingIntent: CallBookingIntent;
  qualityScore: number;
  sentiment: CallSentiment;
  treatmentMentioned: string | null;
}

export interface CallIntelligenceGeneration {
  fallbackReason: string | null;
  fields: CallIntelligenceFields;
  model: string | null;
  provider: "deterministic" | "openai";
  responseId: string | null;
}

interface OpenAIResponsePayload {
  id?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
      type?: string;
    }>;
    type?: string;
  }>;
  output_text?: string;
}

const sentiments = new Set<CallSentiment>(["positive", "neutral", "negative", "unknown"]);
const bookingIntents = new Set<CallBookingIntent>(["none", "low", "medium", "high", "booked"]);

const treatmentKeywords = [
  "Invisalign",
  "implant",
  "implants",
  "veneers",
  "whitening",
  "composite bonding",
  "hygiene",
  "orthodontics",
  "facial aesthetics",
  "Botox",
  "filler",
  "skin",
  "consultation",
];

function extractResponseText(payload: OpenAIResponsePayload) {
  if (typeof payload.output_text === "string") return payload.output_text;

  return (payload.output || [])
    .flatMap((item) => item.content || [])
    .map((content) => content.text || "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

function compact(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function parseCallIntelligencePayload(text: string): CallIntelligenceFields | null {
  const parsed = JSON.parse(text) as Record<string, unknown>;
  const aiSummary = typeof parsed.aiSummary === "string" ? compact(parsed.aiSummary).slice(0, 10000) : "";
  const bookingIntent = typeof parsed.bookingIntent === "string" && bookingIntents.has(parsed.bookingIntent as CallBookingIntent)
    ? parsed.bookingIntent as CallBookingIntent
    : null;
  const sentiment = typeof parsed.sentiment === "string" && sentiments.has(parsed.sentiment as CallSentiment)
    ? parsed.sentiment as CallSentiment
    : null;
  const treatmentMentioned = typeof parsed.treatmentMentioned === "string"
    ? compact(parsed.treatmentMentioned).slice(0, 255) || null
    : null;
  const qualityScore = typeof parsed.qualityScore === "number" ? clampScore(parsed.qualityScore) : null;

  if (!aiSummary || !bookingIntent || !sentiment || qualityScore === null) return null;

  return {
    aiSummary,
    bookingIntent,
    qualityScore,
    sentiment,
    treatmentMentioned,
  };
}

function inferTreatment(text: string) {
  const normalized = text.toLowerCase();
  const match = treatmentKeywords.find((keyword) => normalized.includes(keyword.toLowerCase()));
  if (!match) return null;
  if (match === "implants") return "Implants";
  if (match === "implant") return "Implants";
  return `${match.charAt(0).toUpperCase()}${match.slice(1)}`;
}

function inferSentiment(text: string): CallSentiment {
  const normalized = text.toLowerCase();
  const negativeMatches = ["angry", "complaint", "complained", "unhappy", "frustrated", "expensive", "too much", "cancel", "cancelled", "problem"];
  const positiveMatches = ["book", "booked", "happy", "great", "interested", "yes", "perfect", "thanks", "thank you", "excited"];

  if (negativeMatches.some((word) => normalized.includes(word))) return "negative";
  if (positiveMatches.some((word) => normalized.includes(word))) return "positive";
  return text ? "neutral" : "unknown";
}

function inferBookingIntent(text: string, outcome: string | null): CallBookingIntent {
  const normalized = text.toLowerCase();

  if (outcome === "booked_consult" || /\b(booked|scheduled|appointment confirmed)\b/.test(normalized)) return "booked";
  if (/\b(book|appointment|consultation|availability|diary|schedule)\b/.test(normalized)) return "high";
  if (/\b(price|cost|interested|options|treatment|quote)\b/.test(normalized)) return "medium";
  if (/\b(info|information|callback|call back|thinking)\b/.test(normalized)) return "low";
  return "none";
}

function deterministicCallIntelligence(input: CallIntelligenceInput): CallIntelligenceFields {
  const sourceText = compact(input.transcript || input.notes);
  const fallbackContext = `${input.contactName} ${input.direction} call, ${Math.round(input.duration / 60)} minutes, outcome ${input.outcome || "not set"}.`;
  const summarySource = sourceText || fallbackContext;
  const treatmentMentioned = inferTreatment(summarySource);
  const sentiment = inferSentiment(summarySource);
  const bookingIntent = inferBookingIntent(summarySource, input.outcome);
  let qualityScore = input.duration > 0 ? 45 : 20;

  if (input.transcript) qualityScore += 15;
  if (input.notes) qualityScore += 10;
  if (bookingIntent === "booked") qualityScore += 25;
  else if (bookingIntent === "high") qualityScore += 18;
  else if (bookingIntent === "medium") qualityScore += 10;
  if (sentiment === "positive") qualityScore += 8;
  if (sentiment === "negative") qualityScore -= 10;
  if (treatmentMentioned) qualityScore += 7;

  return {
    aiSummary: summarySource.length > 650 ? `${summarySource.slice(0, 647)}...` : summarySource,
    bookingIntent,
    qualityScore: clampScore(qualityScore),
    sentiment,
    treatmentMentioned,
  };
}

export class OpenAICallIntelligenceService {
  async generate(input: CallIntelligenceInput): Promise<CallIntelligenceGeneration> {
    const deterministicFields = deterministicCallIntelligence(input);

    if (!config.openai.callIntelligenceEnabled) {
      return this.fallback(deterministicFields, "disabled");
    }

    if (!config.openai.apiKey) {
      return this.fallback(deterministicFields, "missing_api_key");
    }

    try {
      const response = await fetch(config.openai.apiUrl, {
        method: "POST",
        signal: AbortSignal.timeout(config.openai.timeoutMs),
        headers: {
          Authorization: `Bearer ${config.openai.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.openai.callIntelligenceModel,
          instructions: [
            "You are a ClinicGrower call intelligence analyst.",
            "Extract concise commercial call intelligence for a dental or aesthetics clinic.",
            "Do not invent facts. Use only the call metadata, notes and transcript.",
            "If a field is not evidenced, use unknown, none, null, or a conservative score.",
          ].join(" "),
          input: JSON.stringify(input),
          text: {
            format: {
              type: "json_schema",
              name: "call_intelligence",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                required: ["aiSummary", "sentiment", "bookingIntent", "treatmentMentioned", "qualityScore"],
                properties: {
                  aiSummary: { type: "string" },
                  sentiment: {
                    type: "string",
                    enum: ["positive", "neutral", "negative", "unknown"],
                  },
                  bookingIntent: {
                    type: "string",
                    enum: ["none", "low", "medium", "high", "booked"],
                  },
                  treatmentMentioned: {
                    type: ["string", "null"],
                  },
                  qualityScore: {
                    type: "integer",
                    minimum: 0,
                    maximum: 100,
                  },
                },
              },
            },
          },
          max_output_tokens: 1200,
        }),
      });

      const body = await response.text();
      let payload: OpenAIResponsePayload | { error?: unknown } | undefined;

      try {
        payload = body ? JSON.parse(body) : undefined;
      } catch {
        payload = undefined;
      }

      if (!response.ok) {
        logger.warn("OpenAI call intelligence generation failed", {
          response: payload || body,
          status: response.status,
        });
        return this.fallback(deterministicFields, `http_${response.status}`);
      }

      const responsePayload = payload as OpenAIResponsePayload | undefined;
      const outputText = responsePayload ? extractResponseText(responsePayload) : "";
      const fields = outputText ? parseCallIntelligencePayload(outputText) : null;

      if (!fields) {
        logger.warn("OpenAI call intelligence returned no usable fields", {
          responseId: responsePayload?.id,
        });
        return this.fallback(deterministicFields, "empty_response");
      }

      return {
        fallbackReason: null,
        fields,
        model: config.openai.callIntelligenceModel,
        provider: "openai",
        responseId: responsePayload?.id || null,
      };
    } catch (error) {
      logger.warn("OpenAI call intelligence generation threw", {
        error: error instanceof Error ? error.message : String(error),
      });
      return this.fallback(deterministicFields, "request_failed");
    }
  }

  private fallback(fields: CallIntelligenceFields, reason: string | null): CallIntelligenceGeneration {
    return {
      fallbackReason: reason,
      fields,
      model: null,
      provider: "deterministic",
      responseId: null,
    };
  }
}

export const openAICallIntelligenceService = new OpenAICallIntelligenceService();
