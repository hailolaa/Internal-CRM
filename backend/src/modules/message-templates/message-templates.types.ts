export const MESSAGE_TEMPLATE_CHANNELS = ["email", "sms"] as const;
export const MESSAGE_TEMPLATE_STATUSES = ["draft", "active", "archived"] as const;

export const MESSAGE_TEMPLATE_PLACEHOLDERS = [
  {
    key: "patient_name",
    label: "Patient name",
    description: "The contact's full name.",
    example: "{{patient_name}}",
  },
  {
    key: "clinic_name",
    label: "Clinic name",
    description: "Your clinic display name.",
    example: "{{clinic_name}}",
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
