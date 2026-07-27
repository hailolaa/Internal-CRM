export const MESSAGE_TEMPLATE_CHANNELS = ["email", "sms"] as const;
export const MESSAGE_TEMPLATE_STATUSES = ["draft", "active", "archived"] as const;

export const MESSAGE_TEMPLATE_PLACEHOLDERS = [
  {
    key: "patient_name",
    label: "Contact name",
    description: "The lead or client contact's full name.",
    example: "{{patient_name}}",
  },
  {
    key: "clinic_name",
    label: "Account name",
    description: "The lead or client account name.",
    example: "{{clinic_name}}",
  },
  {
    key: "first_name",
    label: "First name",
    description: "The contact's first name.",
    example: "{{first_name}}",
  },
  {
    key: "account_name",
    label: "Account name",
    description: "The lead or client account name.",
    example: "{{account_name}}",
  },
  {
    key: "clinic_growth_score",
    label: "Clinic Growth Score",
    description: "The current or proposed Clinic Growth Score value.",
    example: "{{clinic_growth_score}}",
  },
  {
    key: "recommended_next_package",
    label: "Recommended next package",
    description: "The package Mission Control recommends next.",
    example: "{{recommended_next_package}}",
  },
  {
    key: "package_interest",
    label: "Package interest",
    description: "The package or service the lead is interested in.",
    example: "{{package_interest}}",
  },
  {
    key: "guide_name",
    label: "Guide name",
    description: "The free guide or lead magnet downloaded.",
    example: "{{guide_name}}",
  },
  {
    key: "proposal_link",
    label: "Proposal link",
    description: "The proposal URL to share with the contact.",
    example: "{{proposal_link}}",
  },
  {
    key: "appointment_date",
    label: "Appointment date",
    description: "The formatted appointment date/time.",
    example: "{{appointment_date}}",
  },
  {
    key: "treatment",
    label: "Treatment",
    description: "The booked or requested treatment.",
    example: "{{treatment}}",
  },
] as const;

export interface MessageTemplateResponse {
  id: string;
  name: string;
  channel: (typeof MESSAGE_TEMPLATE_CHANNELS)[number];
  subject: string | null;
  body: string;
  status: (typeof MESSAGE_TEMPLATE_STATUSES)[number];
  createdAt: string;
  updatedAt: string;
  availablePlaceholders: typeof MESSAGE_TEMPLATE_PLACEHOLDERS;
}

export interface CreateMessageTemplateDTO {
  name: string;
  channel?: (typeof MESSAGE_TEMPLATE_CHANNELS)[number];
  subject?: string;
  body: string;
  status?: (typeof MESSAGE_TEMPLATE_STATUSES)[number];
}

export type UpdateMessageTemplateDTO = Partial<CreateMessageTemplateDTO>;

export interface MessageTemplateFilters {
  channel?: (typeof MESSAGE_TEMPLATE_CHANNELS)[number];
  status?: (typeof MESSAGE_TEMPLATE_STATUSES)[number];
}

export interface RenderMessageTemplateVariables {
  patient_name?: string | null;
  clinic_name?: string | null;
  appointment_date?: string | null;
  treatment?: string | null;
  [key: string]: string | number | boolean | null | undefined;
}

export interface TestSendMessageTemplateDTO {
  recipient: string;
  channel?: (typeof MESSAGE_TEMPLATE_CHANNELS)[number];
  variables?: RenderMessageTemplateVariables;
}

export interface TestSendMessageTemplateResponse {
  templateId: string;
  channel: (typeof MESSAGE_TEMPLATE_CHANNELS)[number];
  recipient: string;
  deliveryStatus: "sent" | "queued" | "failed";
  messageId: string | null;
  subject: string | null;
  missingVariables: string[];
  renderedBody: string;
}
