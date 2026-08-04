"use client";

import { Bot, Braces, CircleHelp, PencilLine, Sparkles } from "lucide-react";
import type {
  AiGenerationProvenance as AiGenerationProvenanceRecord,
  AiRunRecord,
} from "@/lib/api-types";

export type AiGenerationMethod =
  | "openai"
  | "rules"
  | "manual"
  | "fallback"
  | "unknown";

export interface AiGenerationDisclosure {
  method: AiGenerationMethod;
  label: string;
  description: string;
  model: string | null;
  fallbackReason: string | null;
  generatedAt: string | null;
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function optionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function optionalBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function optionalStringRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const entries = Object.entries(value).filter(
    (entry): entry is [string, string] =>
      typeof entry[1] === "string" && Boolean(entry[1].trim()),
  );
  return entries.length ? Object.fromEntries(entries) : null;
}

export function formatFallbackReason(value?: string | null) {
  const reason = optionalString(value);
  if (!reason) return null;
  if (reason.includes(" ")) return reason;

  const knownReasons: Record<string, string> = {
    ai_processing_consent_not_captured:
      "External AI processing consent was not captured",
    consent_not_captured:
      "External AI processing consent was not captured",
    disabled: "AI enrichment is disabled",
    missing_ai_enrichment: "AI enrichment was unavailable",
    missing_api_key: "The AI provider is not configured",
    missing_openai_api_key: "OpenAI is not configured",
    openai_disabled: "OpenAI generation is disabled",
  };
  if (knownReasons[reason]) return knownReasons[reason];
  if (/^http_\d+$/i.test(reason) || /^openai_http_\d+$/i.test(reason)) {
    return `The AI provider returned error ${reason.match(/\d+/)?.[0] || ""}`.trim();
  }
  return reason.replace(/[_-]+/g, " ");
}

export function coerceAiGenerationProvenance(
  value: unknown,
  generatedAt?: string | null,
): AiGenerationProvenanceRecord | null {
  if (!value || typeof value !== "object") {
    return generatedAt ? { generatedAt } : null;
  }

  const record = value as Record<string, unknown>;
  return {
    workflow: optionalString(record.workflow),
    source: optionalString(record.source),
    provider: optionalString(record.provider),
    method: optionalString(record.method),
    model: optionalString(record.model),
    responseId: optionalString(record.responseId),
    fallbackReason: optionalString(record.fallbackReason),
    generatedAt: optionalString(record.generatedAt) || generatedAt || null,
    tokens: optionalNumber(record.tokens),
    externalProcessing: optionalBoolean(record.externalProcessing),
    consentScope: optionalString(record.consentScope),
    consentCaptured: optionalBoolean(record.consentCaptured),
    persisted: optionalBoolean(record.persisted),
    clinicScoped: optionalBoolean(record.clinicScoped),
    openAiRequired: optionalBoolean(record.openAiRequired),
    fallbackAvailable: optionalBoolean(record.fallbackAvailable),
    mockData: optionalBoolean(record.mockData),
    calibrated: optionalBoolean(record.calibrated),
    algorithmVersion: optionalString(record.algorithmVersion),
    scoreMeaning: optionalString(record.scoreMeaning),
    legacyAliases: optionalStringRecord(record.legacyAliases),
    inputMode: optionalString(record.inputMode),
    sources: optionalStringRecord(record.sources),
    range:
      record.range && typeof record.range === "object"
        ? {
            startDate: optionalString(
              (record.range as Record<string, unknown>).startDate,
            ),
            endDate: optionalString(
              (record.range as Record<string, unknown>).endDate,
            ),
          }
        : null,
  };
}

export function coerceAiRunProvenance(
  run?: AiRunRecord | null,
): AiGenerationProvenanceRecord | null {
  if (!run) return null;

  const outputProvenance =
    run.output &&
    typeof run.output === "object" &&
    "provenance" in run.output
      ? (run.output as { provenance?: unknown }).provenance
      : null;
  const outputRecord =
    outputProvenance && typeof outputProvenance === "object"
      ? (outputProvenance as Record<string, unknown>)
      : {};

  return coerceAiGenerationProvenance(
    {
      ...outputRecord,
      provider: optionalString(outputRecord.provider) || run.provider,
      model: optionalString(outputRecord.model) || run.model,
      responseId: optionalString(outputRecord.responseId) || run.responseId,
      fallbackReason:
        optionalString(outputRecord.fallbackReason) ||
        run.fallbackReason ||
        run.errorCode,
    },
    run.createdAt,
  );
}

export function describeAiGeneration(
  provenance?: AiGenerationProvenanceRecord | null,
  generatedAt?: string | null,
): AiGenerationDisclosure {
  const provider = String(provenance?.provider || "").trim().toLowerCase();
  const recordedMethod = String(provenance?.method || "")
    .trim()
    .toLowerCase();
  const fallbackReason = formatFallbackReason(provenance?.fallbackReason);
  const resolvedGeneratedAt =
    optionalString(provenance?.generatedAt) || generatedAt || null;

  if (fallbackReason) {
    return {
      method: "fallback",
      label: "Rules-based fallback",
      description:
        "AI enrichment was unavailable, so deterministic clinic rules produced this output.",
      model: optionalString(provenance?.model),
      fallbackReason,
      generatedAt: resolvedGeneratedAt,
    };
  }

  if (provider === "openai" || recordedMethod === "openai") {
    return {
      method: "openai",
      label: "OpenAI generated",
      description: "Generated by OpenAI from the recorded clinic inputs.",
      model: optionalString(provenance?.model),
      fallbackReason: null,
      generatedAt: resolvedGeneratedAt,
    };
  }

  if (provider === "manual" || recordedMethod === "manual") {
    return {
      method: "manual",
      label: "Manually entered",
      description:
        "Entered or edited by a clinic user; no generative AI was used.",
      model: null,
      fallbackReason: null,
      generatedAt: resolvedGeneratedAt,
    };
  }

  if (
    provider === "deterministic" ||
    provider === "rules" ||
    provider === "rule_based" ||
    provider === "rule-based" ||
    recordedMethod === "deterministic_rules"
  ) {
    return {
      method: "rules",
      label: "Rules-based",
      description:
        "Calculated with deterministic clinic rules; no generative AI was used.",
      model: null,
      fallbackReason: null,
      generatedAt: resolvedGeneratedAt,
    };
  }

  return {
    method: "unknown",
    label: provider ? `${provider} generated` : "Method not recorded",
    description: provider
      ? `The backend recorded ${provider} as the provider, but no recognised generation method is available.`
      : "This legacy output does not record whether AI or deterministic rules produced it.",
    model: optionalString(provenance?.model),
    fallbackReason: null,
    generatedAt: resolvedGeneratedAt,
  };
}

export function formatGenerationAge(
  value?: string | null,
  now: Date = new Date(),
) {
  if (!value) return null;
  const generated = new Date(value);
  if (Number.isNaN(generated.getTime())) return null;

  const elapsedMs = Math.max(0, now.getTime() - generated.getTime());
  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d ago`;

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: generated.getFullYear() === now.getFullYear() ? undefined : "numeric",
  }).format(generated);
}

function methodClasses(method: AiGenerationMethod) {
  if (method === "openai") {
    return "border-[rgba(96,180,175,0.25)] bg-[rgba(96,180,175,0.08)] text-[#315F5C]";
  }
  if (method === "rules") {
    return "border-[#E5E7EB] bg-[#FAF9F7] text-[#5E6E70]";
  }
  if (method === "manual") {
    return "border-[rgba(154,85,36,0.2)] bg-[rgba(154,85,36,0.06)] text-[#9A5524]";
  }
  if (method === "fallback") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-[#E5E7EB] bg-white text-[#5E6E70]";
}

export function AiGenerationProvenance({
  provenance,
  generatedAt,
  compact = false,
}: {
  provenance?: AiGenerationProvenanceRecord | null;
  generatedAt?: string | null;
  compact?: boolean;
}) {
  const disclosure = describeAiGeneration(provenance, generatedAt);
  const Icon =
    disclosure.method === "openai"
      ? Sparkles
      : disclosure.method === "rules"
        ? Braces
        : disclosure.method === "manual"
          ? PencilLine
        : disclosure.method === "fallback"
          ? Bot
          : CircleHelp;
  const age = formatGenerationAge(disclosure.generatedAt);
  const timestampVerb =
    disclosure.method === "manual" ? "Recorded" : "Generated";
  const generatedDate = disclosure.generatedAt
    ? new Date(disclosure.generatedAt)
    : null;
  const generatedTitle =
    generatedDate && !Number.isNaN(generatedDate.getTime())
    ? new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(generatedDate)
    : undefined;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-[#5E6E70]">
      <span
        title={disclosure.description}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold ${methodClasses(disclosure.method)}`}
      >
        <Icon className="h-3.5 w-3.5" />
        {disclosure.label}
      </span>
      {disclosure.model && !compact ? (
        <span className="rounded-full border border-[#E5E7EB] bg-white px-2.5 py-1">
          Model {disclosure.model}
        </span>
      ) : null}
      {provenance?.inputMode && !compact ? (
        <span className="rounded-full border border-[#E5E7EB] bg-white px-2.5 py-1">
          {provenance.inputMode === "live" ? "Live inputs" : "Manual inputs"}
        </span>
      ) : null}
      {age ? (
        <span title={generatedTitle}>
          {timestampVerb} {age}
        </span>
      ) : (
        <span>{timestampVerb} time not recorded</span>
      )}
      {disclosure.fallbackReason && !compact ? (
        <span className="basis-full text-amber-700">
          Fallback reason: {disclosure.fallbackReason}
        </span>
      ) : null}
      {provenance?.externalProcessing === true && !compact ? (
        <span className="basis-full">
          External processing ·{" "}
          {provenance.consentCaptured === true
            ? "consent recorded"
            : provenance.consentCaptured === false
              ? "consent not recorded"
              : "consent status not recorded"}
        </span>
      ) : null}
      {provenance?.scoreMeaning && !compact ? (
        <span className="basis-full">{provenance.scoreMeaning}</span>
      ) : null}
    </div>
  );
}
