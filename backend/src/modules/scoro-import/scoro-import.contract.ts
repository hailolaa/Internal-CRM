export const SCORO_SOURCE_SYSTEM = "scoro" as const;

export const SCORO_ENTITY_ORDER = ["contact", "lead", "client", "task_followup"] as const;

export type ScoroSourceSystem = typeof SCORO_SOURCE_SYSTEM;
export type ScoroEntity = (typeof SCORO_ENTITY_ORDER)[number];

export type ScoroValidationStatus = "valid" | "mapped" | "quarantined";

export type ScoroQuarantineReason =
  | "missing_source_id"
  | "invalid_required_fields"
  | "duplicate_scoro_id"
  | "ambiguous_strong_match"
  | "cross_tenant_relationship"
  | "invalid_enum"
  | "invalid_date"
  | "invalid_money"
  | "invalid_boolean"
  | "unresolved_related_scoro_id"
  | "unsupported_owner_mapping";

export type ScoroWarningReason =
  | "source_duplicate_email"
  | "source_duplicate_phone"
  | "source_duplicate_domain"
  | "name_similarity_only";

export interface ScoroEntityContract {
  entity: ScoroEntity;
  filename: string;
  headers: readonly string[];
  requiredValueHeaders: readonly string[];
  dateHeaders: readonly string[];
  booleanHeaders: readonly string[];
  moneyHeaders: readonly string[];
  enumHeaders: Readonly<Record<string, readonly string[]>>;
  ownerHeaders: readonly string[];
}

const commonTraceHeaders = ["scoro_record_id", "scoro_url", "scoro_exported_at"] as const;

export const SCORO_ENTITY_CONTRACTS: Readonly<Record<ScoroEntity, ScoroEntityContract>> = {
  lead: {
    entity: "lead",
    filename: "scoro-leads-template.csv",
    headers: [
      ...commonTraceHeaders,
      "account_name",
      "contact_first_name",
      "contact_last_name",
      "email",
      "phone",
      "website",
      "location",
      "first_source",
      "latest_source",
      "converting_source",
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "landing_page",
      "referrer",
      "form_submitted",
      "cta_clicked",
      "lead_status",
      "pipeline_stage",
      "package_interest",
      "recommended_package",
      "owner_email",
      "last_contact_at",
      "follow_up_due_at",
      "contact_attempts",
      "can_email",
      "can_call",
      "can_whatsapp_message",
      "do_not_contact",
      "permission_source",
      "notes",
    ],
    requiredValueHeaders: ["scoro_record_id", "scoro_exported_at", "account_name"],
    dateHeaders: ["scoro_exported_at", "last_contact_at", "follow_up_due_at"],
    booleanHeaders: ["can_email", "can_call", "can_whatsapp_message", "do_not_contact"],
    moneyHeaders: [],
    enumHeaders: {
      lead_status: ["new", "open", "contacted", "qualified", "unqualified", "converted", "won", "lost", "nurture"],
    },
    ownerHeaders: ["owner_email"],
  },
  contact: {
    entity: "contact",
    filename: "scoro-contacts-template.csv",
    headers: [
      ...commonTraceHeaders,
      "account_name",
      "first_name",
      "last_name",
      "role",
      "email",
      "phone",
      "can_email",
      "can_call",
      "can_whatsapp_message",
      "unsubscribed",
      "do_not_contact",
      "permission_source",
      "opt_in_at",
      "opt_out_at",
      "notes",
    ],
    requiredValueHeaders: ["scoro_record_id", "scoro_exported_at", "account_name", "first_name", "last_name"],
    dateHeaders: ["scoro_exported_at", "opt_in_at", "opt_out_at"],
    booleanHeaders: ["can_email", "can_call", "can_whatsapp_message", "unsubscribed", "do_not_contact"],
    moneyHeaders: [],
    enumHeaders: {},
    ownerHeaders: [],
  },
  client: {
    entity: "client",
    filename: "scoro-clients-template.csv",
    headers: [
      ...commonTraceHeaders,
      "account_name",
      "website",
      "city",
      "country",
      "client_type",
      "current_package",
      "recommended_next_package",
      "monthly_price",
      "setup_fee",
      "currency",
      "client_status",
      "contract_status",
      "payment_status",
      "invoice_status",
      "contract_start_date",
      "renewal_notice_date",
      "client_owner_email",
      "main_drive_folder_url",
      "notes",
    ],
    requiredValueHeaders: ["scoro_record_id", "scoro_exported_at", "account_name"],
    dateHeaders: ["scoro_exported_at", "contract_start_date", "renewal_notice_date"],
    booleanHeaders: [],
    moneyHeaders: ["monthly_price", "setup_fee"],
    enumHeaders: {
      client_status: ["active", "inactive", "paused", "churned", "prospect", "lead"],
      contract_status: ["draft", "sent", "signed", "expired", "cancelled", "canceled", "none"],
      payment_status: ["active", "overdue", "paused", "failed", "none"],
      invoice_status: ["current", "overdue", "pending", "none"],
    },
    ownerHeaders: ["client_owner_email"],
  },
  task_followup: {
    entity: "task_followup",
    filename: "scoro-tasks-followups-template.csv",
    headers: [
      ...commonTraceHeaders,
      "related_type",
      "related_scoro_id",
      "related_account_name",
      "related_email",
      "title",
      "description",
      "owner_email",
      "due_date",
      "priority",
      "status",
      "category",
      "follow_up_type",
      "notes",
    ],
    requiredValueHeaders: ["scoro_record_id", "scoro_exported_at", "related_type", "related_scoro_id", "title", "due_date", "status"],
    dateHeaders: ["scoro_exported_at", "due_date"],
    booleanHeaders: [],
    moneyHeaders: [],
    enumHeaders: {
      related_type: ["lead", "client", "contact"],
      priority: ["low", "normal", "medium", "high", "urgent"],
      status: ["open", "in_progress", "done", "completed", "cancelled", "canceled", "deferred"],
    },
    ownerHeaders: ["owner_email"],
  },
};

export function getScoroContract(entity: ScoroEntity): ScoroEntityContract {
  return SCORO_ENTITY_CONTRACTS[entity];
}

export function buildScoroIdentity(entity: ScoroEntity, sourceRecordId: string): string {
  return `${SCORO_SOURCE_SYSTEM}:${entity}:${sourceRecordId.trim()}`;
}
