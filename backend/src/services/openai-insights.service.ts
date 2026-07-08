import { config } from "../config/index.js";
import logger from "../utils/logger.js";
import type { InsightSeverity } from "../modules/insights/insights.types.js";

export interface RevenueLeakInsightInput {
  contactName: string;
  dedupeKey: string;
  estimatedRisk: number;
  leakKey: string;
  nextAction: string;
  occurredAt: string | null;
  ownerName: string;
  reason: string;
  source: string;
  treatment: string;
}

export interface RevenueLeakInsightEnrichment {
  dedupeKey: string;
  recommendedAction: string;
  severity: InsightSeverity;
  summary: string;
  title: string;
}

export interface RevenueLeakInsightGeneration {
  enrichments: Map<string, RevenueLeakInsightEnrichment>;
  fallbackReason: string | null;
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

const severities = new Set<InsightSeverity>(["low", "medium", "high", "critical"]);

function asSeverity(value: unknown): InsightSeverity | null {
  return typeof value === "string" && severities.has(value as InsightSeverity)
    ? value as InsightSeverity
    : null;
}

function extractResponseText(payload: OpenAIResponsePayload) {
  if (typeof payload.output_text === "string") return payload.output_text;

  return (payload.output || [])
    .flatMap((item) => item.content || [])
    .map((content) => content.text || "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

function parseInsightPayload(text: string) {
  const parsed = JSON.parse(text) as { insights?: unknown };
  if (!Array.isArray(parsed.insights)) return [];

  return parsed.insights.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const dedupeKey = typeof row.dedupeKey === "string" ? row.dedupeKey : "";
    const title = typeof row.title === "string" ? row.title.trim() : "";
    const summary = typeof row.summary === "string" ? row.summary.trim() : "";
    const recommendedAction = typeof row.recommendedAction === "string" ? row.recommendedAction.trim() : "";
    const severity = asSeverity(row.severity);

    if (!dedupeKey || !title || !summary || !recommendedAction || !severity) return [];

    return [{
      dedupeKey,
      recommendedAction,
      severity,
      summary,
      title,
    }];
  });
}

export class OpenAIInsightsService {
  async generateRevenueLeakInsights(records: RevenueLeakInsightInput[]): Promise<RevenueLeakInsightGeneration> {
    if (records.length === 0) {
      return this.fallback(null);
    }

    if (!config.openai.insightsEnabled) {
      return this.fallback("disabled");
    }

    if (!config.openai.apiKey) {
      return this.fallback("missing_api_key");
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
          model: config.openai.insightsModel,
          instructions: [
            "You are The Growth Group's revenue operations analyst.",
            "Turn revenue leakage records into concise, commercially useful CRM insights.",
            "Do not invent facts. Use only the provided record fields.",
            "Return one insight per input record using the same dedupeKey.",
          ].join(" "),
          input: JSON.stringify({ records }),
          text: {
            format: {
              type: "json_schema",
              name: "revenue_leak_insights",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                required: ["insights"],
                properties: {
                  insights: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      required: ["dedupeKey", "title", "summary", "recommendedAction", "severity"],
                      properties: {
                        dedupeKey: { type: "string" },
                        title: { type: "string" },
                        summary: { type: "string" },
                        recommendedAction: { type: "string" },
                        severity: {
                          type: "string",
                          enum: ["low", "medium", "high", "critical"],
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          max_output_tokens: 3500,
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
        logger.warn("OpenAI insight generation failed", {
          response: payload || body,
          status: response.status,
        });
        return this.fallback(`http_${response.status}`);
      }

      const responsePayload = payload as OpenAIResponsePayload | undefined;
      const outputText = responsePayload ? extractResponseText(responsePayload) : "";
      const rows = outputText ? parseInsightPayload(outputText) : [];

      if (rows.length === 0) {
        logger.warn("OpenAI insight generation returned no usable insights", {
          responseId: responsePayload?.id,
        });
        return this.fallback("empty_response");
      }

      return {
        enrichments: new Map(rows.map((row) => [row.dedupeKey, row])),
        fallbackReason: null,
        model: config.openai.insightsModel,
        provider: "openai",
        responseId: responsePayload?.id || null,
      };
    } catch (error) {
      logger.warn("OpenAI insight generation threw", {
        error: error instanceof Error ? error.message : String(error),
      });
      return this.fallback("request_failed");
    }
  }

  private fallback(reason: string | null): RevenueLeakInsightGeneration {
    return {
      enrichments: new Map(),
      fallbackReason: reason,
      model: null,
      provider: "deterministic",
      responseId: null,
    };
  }
}

export const openAIInsightsService = new OpenAIInsightsService();
