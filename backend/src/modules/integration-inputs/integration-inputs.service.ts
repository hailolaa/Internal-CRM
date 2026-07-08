import { v4 as uuidv4 } from "uuid";
import pool from "../../config/database.js";
import { config } from "../../config/index.js";
import { ApiError } from "../../utils/ApiError.js";
import { logAuditEvent } from "../../utils/audit.js";
import { billingService } from "../billing/billing.service.js";
import { contactsService } from "../contacts/contacts.service.js";
import type {
  IngestLeadDTO,
  ManualPlatformMetricDTO,
  ManualPlatformMetricQuery,
  SummaryPreviewDTO,
} from "./integration-inputs.types.js";

function cleanString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function parseJson(value: unknown, fallback: unknown = null) {
  if (!value) return fallback;
  if (typeof value === "object") return value;

  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function toPayloadRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function splitName(data: IngestLeadDTO) {
  const firstName = cleanString(data.firstName);
  const lastName = cleanString(data.lastName);
  if (firstName || lastName) return { firstName, lastName };

  const fullName = cleanString(data.fullName);
  if (!fullName) return { firstName: null, lastName: null };

  const parts = fullName.split(/\s+/);
  return {
    firstName: parts.shift() || null,
    lastName: parts.join(" ") || null,
  };
}

function normalizeTreatmentInterests(data: IngestLeadDTO) {
  const values = Array.isArray(data.treatmentInterests)
    ? data.treatmentInterests
    : data.treatmentInterest
      ? [data.treatmentInterest]
      : [];

  return Array.from(new Set(values.map((value) => cleanString(value)).filter(Boolean) as string[]));
}

function fallbackSummary(promptType: string, context: Record<string, unknown>) {
  const keys = Object.keys(context).slice(0, 6);
  return [
    `OpenAI summary generation is ${config.openai.insightsEnabled ? "not available" : "disabled"} for ${promptType}.`,
    keys.length > 0 ? `Context received: ${keys.join(", ")}.` : "No context fields were supplied.",
    "Use the stored context for manual review until live AI generation is enabled.",
  ].join(" ");
}

export class IntegrationInputsService {
  async ingestMetaLead(clinicId: string, data: IngestLeadDTO, actorId: string | null = null) {
    return this.ingestLead(clinicId, "meta_lead_form", data, actorId);
  }

  async ingestManualLead(clinicId: string, userId: string, data: IngestLeadDTO) {
    return this.ingestLead(clinicId, "manual_lead_import", data, userId);
  }

  async listManualPlatformMetrics(clinicId: string, query: ManualPlatformMetricQuery = {}) {
    const conditions = ["clinic_id = ?", "deleted_at IS NULL"];
    const values: any[] = [clinicId];

    if (query.platform) {
      conditions.push("platform = ?");
      values.push(query.platform);
    }
    if (query.metricName) {
      conditions.push("metric_name = ?");
      values.push(query.metricName);
    }
    if (query.campaign) {
      conditions.push("campaign = ?");
      values.push(query.campaign);
    }
    if (query.from) {
      conditions.push("metric_date >= ?");
      values.push(query.from.slice(0, 10));
    }
    if (query.to) {
      conditions.push("metric_date <= ?");
      values.push(query.to.slice(0, 10));
    }

    const [rows]: any = await pool.execute(
      `SELECT id, platform, metric_date as metricDate, campaign, location_label as locationLabel,
              metric_name as metricName, metric_value as metricValue, unit,
              attribution_label as attributionLabel, raw_payload as rawPayload,
              notes, created_at as createdAt, updated_at as updatedAt
       FROM manual_platform_metric
       WHERE ${conditions.join(" AND ")}
       ORDER BY metric_date DESC, platform ASC, metric_name ASC
       LIMIT 500`,
      values,
    );

    return rows.map((row: any) => ({
      id: row.id,
      platform: row.platform,
      metricDate: row.metricDate ? new Date(row.metricDate).toISOString().slice(0, 10) : null,
      campaign: row.campaign || null,
      locationLabel: row.locationLabel || null,
      metricName: row.metricName,
      metricValue: Number(row.metricValue || 0),
      unit: row.unit || null,
      attributionLabel: row.attributionLabel || null,
      dataSource: getMetricDataSource(row.attributionLabel),
      rawPayload: parseJson(row.rawPayload, null),
      notes: row.notes || null,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    }));
  }

  async createManualPlatformMetric(clinicId: string, userId: string, data: ManualPlatformMetricDTO) {
    const id = uuidv4();
    await pool.execute(
      `INSERT INTO manual_platform_metric
        (id, clinic_id, platform, metric_date, campaign, location_label,
         metric_name, metric_value, unit, attribution_label, raw_payload, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        clinicId,
        data.platform,
        data.metricDate.slice(0, 10),
        data.campaign || null,
        data.locationLabel || null,
        data.metricName,
        data.metricValue,
        data.unit || null,
        data.attributionLabel || null,
        data.rawPayload ? JSON.stringify(data.rawPayload) : null,
        data.notes || null,
        userId,
      ],
    );

    await this.storeRawPayload({
      clinicId,
      source: `manual_metric:${data.platform}`,
      payload: toPayloadRecord(data.rawPayload || data),
      linkedEntityType: "manual_platform_metric",
      linkedEntityId: id,
      status: "processed",
      createdBy: userId,
    });

    await logAuditEvent({
      clinicId,
      userId,
      action: "MANUAL_PLATFORM_METRIC_CREATED",
      entityType: "manual_platform_metric",
      entityId: id,
      changes: { platform: data.platform, metricName: data.metricName, metricValue: data.metricValue },
    });

    return id;
  }

  async getStripePackageSummary(clinicId: string) {
    const billing = await billingService.getBillingStatus(clinicId);
    const [rows]: any = await pool.execute(
      `SELECT id, service_type as serviceType, status, recurring_value as recurringValue,
              contract_status as contractStatus, start_date as startDate,
              renewal_date as renewalDate, end_date as endDate
       FROM client_account_service
       WHERE clinic_id = ?
         AND archived_at IS NULL
         AND status <> 'archived'
       ORDER BY service_type ASC, renewal_date ASC`,
      [clinicId],
    );

    return {
      billing,
      packageSource: billing.hasStripeSubscription ? "stripe_subscription" : "manual_or_unknown",
      services: rows.map((row: any) => ({
        id: row.id,
        serviceType: row.serviceType,
        status: row.status,
        recurringValue: row.recurringValue === null ? null : Number(row.recurringValue),
        contractStatus: row.contractStatus || null,
        startDate: row.startDate ? new Date(row.startDate).toISOString().slice(0, 10) : null,
        renewalDate: row.renewalDate ? new Date(row.renewalDate).toISOString().slice(0, 10) : null,
        endDate: row.endDate ? new Date(row.endDate).toISOString().slice(0, 10) : null,
      })),
    };
  }

  async previewOpenAISummary(clinicId: string, userId: string, data: SummaryPreviewDTO) {
    const promptType = cleanString(data.promptType) || "performance_summary";
    const provider = config.openai.insightsEnabled && config.openai.apiKey ? "openai_ready" : "placeholder";
    const summary = fallbackSummary(promptType, data.context || {});

    await this.storeRawPayload({
      clinicId,
      source: "openai_summary_preview",
      payload: { promptType, context: data.context },
      status: "processed",
      createdBy: userId,
    });

    return {
      provider,
      model: provider === "openai_ready" ? config.openai.insightsModel : null,
      summary,
      fallbackReason: provider === "placeholder"
        ? (config.openai.insightsEnabled ? "missing_openai_api_key_or_runtime_client" : "openai_disabled")
        : null,
    };
  }

  async getSetupAudit(clinicId: string) {
    const [integrationRows]: any = await pool.execute(
      `SELECT type, name, is_active as isActive, last_sync as lastSync
       FROM integration
       WHERE clinic_id = ? AND deleted_at IS NULL`,
      [clinicId],
    );
    const [apiKeyRows]: any = await pool.execute(
      `SELECT COUNT(*) as total
       FROM api_key
       WHERE clinic_id = ? AND revoked_at IS NULL`,
      [clinicId],
    );
    const [formRows]: any = await pool.execute(
      `SELECT COUNT(*) as total
       FROM form_definition
       WHERE clinic_id = ? AND deleted_at IS NULL`,
      [clinicId],
    );
    const [trackingRows]: any = await pool.execute(
      `SELECT COUNT(*) as total
       FROM call_tracking_number
       WHERE clinic_id = ? AND is_active = 1`,
      [clinicId],
    );

    const integrations = new Map(integrationRows.map((row: any) => [row.type, row]));
    return {
      websiteForms: {
        status: Number(formRows[0]?.total || 0) > 0 && Number(apiKeyRows[0]?.total || 0) > 0 ? "ready" : "needs_setup",
        endpoint: "/api/public/forms/:id/submit",
        requires: ["clinic API key", "active form definition"],
      },
      metaLeadForms: {
        status: Number(apiKeyRows[0]?.total || 0) > 0 ? "ready" : "needs_api_key",
        endpoint: "/api/integration-inputs/public/meta-leads",
        requires: ["clinic API key"],
      },
      twilioCalls: {
        status: Number(trackingRows[0]?.total || 0) > 0 || integrations.has("twilio") ? "ready" : "needs_tracking_number",
        endpoints: ["/api/webhooks/twilio/calls", "/api/webhooks/twilio/recordings"],
        requires: ["Twilio status callback URL", "tracking number mapped to clinic"],
      },
      manualMetrics: {
        status: "ready",
        endpoint: "/api/integration-inputs/manual-metrics",
        supports: ["google_ads", "ga4", "google_business_profile", "meta", "seo"],
      },
      stripePackages: {
        status: integrations.has("stripe") ? "connected_or_manual" : "manual_or_env_config",
        endpoint: "/api/integration-inputs/stripe/package-summary",
        requires: ["STRIPE_SECRET_KEY for live checkout/webhooks", "client account service records for package views"],
      },
      openAISummaries: {
        status: config.openai.insightsEnabled && config.openai.apiKey ? "ready" : "placeholder",
        endpoint: "/api/integration-inputs/openai/summary-preview",
        requires: ["OPENAI_INSIGHTS_ENABLED=true", "OPENAI_API_KEY"],
      },
      connectedIntegrations: integrationRows.map((row: any) => ({
        type: row.type,
        name: row.name,
        isActive: !!row.isActive,
        lastSync: row.lastSync ? new Date(row.lastSync).toISOString() : null,
      })),
    };
  }

  private async ingestLead(clinicId: string, source: string, data: IngestLeadDTO, actorId: string | null) {
    const eventId = cleanString(data.eventId) || null;
    const rawPayloadId = await this.storeRawPayload({
      clinicId,
      source,
      sourceEventId: eventId,
      payload: toPayloadRecord(data.rawPayload || data),
      status: "received",
      createdBy: actorId,
    });
    const name = splitName(data);
    const sourceLabel = cleanString(data.source) || (source === "meta_lead_form" ? "meta_leads" : "manual_import");
    const result = await contactsService.createContact(clinicId, actorId as any, {
      ...name,
      email: data.email || null,
      phone: data.phone || null,
      source: sourceLabel,
      status: cleanString(data.status) || "New",
      value: data.value || 0,
      treatmentInterests: normalizeTreatmentInterests(data),
      notes: data.notes || null,
      externalId: eventId || rawPayloadId,
      tags: [source],
    }, {});

    await pool.execute(
      `UPDATE integration_raw_payload
       SET linked_entity_type = 'contact',
           linked_entity_id = ?,
           status = 'processed',
           processed_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ?`,
      [result.contact.id, rawPayloadId, clinicId],
    );

    await logAuditEvent({
      clinicId,
      userId: actorId,
      action: source === "meta_lead_form" ? "META_LEAD_INGESTED" : "MANUAL_LEAD_INGESTED",
      entityType: "contact",
      entityId: result.contact.id,
      changes: { source: sourceLabel, rawPayloadId },
    });

    return {
      contactId: result.contact.id,
      rawPayloadId,
      duplicateCandidates: result.duplicateCandidates || [],
    };
  }

  private async storeRawPayload(input: {
    clinicId: string;
    source: string;
    payload: Record<string, unknown>;
    createdBy?: string | null;
    linkedEntityId?: string | null;
    linkedEntityType?: string | null;
    sourceEventId?: string | null;
    status?: "received" | "processed" | "failed";
  }) {
    const id = uuidv4();

    try {
      await pool.execute(
        `INSERT INTO integration_raw_payload
          (id, clinic_id, source, source_event_id, linked_entity_type, linked_entity_id,
           payload, status, processed_at, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          input.clinicId,
          input.source,
          input.sourceEventId || null,
          input.linkedEntityType || null,
          input.linkedEntityId || null,
          JSON.stringify(input.payload || {}),
          input.status || "received",
          input.status === "processed" ? new Date() : null,
          input.createdBy || null,
        ],
      );
      return id;
    } catch (error: any) {
      if (error?.code === "ER_DUP_ENTRY" && input.sourceEventId) {
        const [rows]: any = await pool.execute(
          `SELECT id, linked_entity_id as linkedEntityId
           FROM integration_raw_payload
           WHERE clinic_id = ? AND source = ? AND source_event_id = ?
           LIMIT 1`,
          [input.clinicId, input.source, input.sourceEventId],
        );
        if (rows[0]?.linkedEntityId) {
          throw ApiError.conflict("Integration event has already been processed.");
        }
        return rows[0]?.id || id;
      }
      throw error;
    }
  }
}

export const integrationInputsService = new IntegrationInputsService();

function getMetricDataSource(attributionLabel: unknown) {
  const label = String(attributionLabel || "");
  if (label.startsWith("connector:")) return label;
  if (label) return "manual";
  return "manual_or_unknown";
}
