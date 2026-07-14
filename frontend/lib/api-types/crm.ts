export interface ManualConsultRecord {
  id: string;
  contactId?: string | null;
  appointmentId?: string | null;
  patientName: string;
  treatment: string;
  practitioner: string;
  practitionerId?: string | null;
  outcome: string;
  revenue: number;
  date: string | null;
  notes: string | null;
  depositStatus?: string;
  lostReason?: string | null;
  enteredBy: string;
  clinicId: string;
}

export interface ConsultSummaryRecord {
  bookedCount: number;
  conversionRate: number;
  noShowCount: number;
  totalConsults: number;
  totalRevenue: number;
}

export interface PractitionerConversionRecord {
  practitioner: string;
  totalConsults: number;
  bookedCount: number;
  conversionRate: number;
  revenue: number;
}

export interface FormDefinitionRecord {
  id: string;
  name: string;
  type: string;
  status: "active" | "draft" | "archived";
  fields: unknown[];
  views: number;
  submissions: number;
  lastSubmission: string | null;
  updatedAt: string;
}

export interface FormSubmissionRecord {
  id: string;
  formName: string;
  contactId: string | null;
  pipelineDealId: string | null;
  name: string;
  email: string;
  phone: string;
  treatment: string;
  status: "new" | "contacted" | "booked" | "completed";
  submittedAt: string;
  source: string;
  archivedAt?: string | null;
}

export type AppointmentStatus =
  | "scheduled"
  | "completed"
  | "no_show"
  | "cancelled";

export interface AppointmentRecord {
  id: string;
  contactId: string;
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  clinicianId: string | null;
  clinicianName: string | null;
  dateTime: string;
  status: AppointmentStatus;
  treatment: string | null;
  valueCents: number;
  durationMinutes: number;
  noShowReason: string | null;
  consultNotes: string | null;
  recurrenceRule: AppointmentRecurrenceRule | null;
  recurrenceSeriesId: string | null;
  recurrencePosition: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface AppointmentClinicianRecord {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
}

export interface AppointmentAvailabilitySlot {
  time: string;
  available: boolean;
  reason: string | null;
}

export interface AppointmentAvailabilityRecord {
  clinicianId: string;
  date: string;
  durationMinutes: number;
  slots: AppointmentAvailabilitySlot[];
}

export interface AppointmentAvailabilityParams {
  appointmentId?: string;
  clinicianId: string;
  date: string;
  durationMinutes?: number;
  intervalMinutes?: number;
}

export interface AppointmentListParams {
  start?: string;
  end?: string;
  status?: AppointmentStatus;
}

export interface AppointmentPayload {
  contactId: string;
  dateTime: string;
  clinicianId?: string | null;
  status?: AppointmentStatus;
  treatment?: string | null;
  valueCents?: number | null;
  durationMinutes?: number | null;
  noShowReason?: string | null;
  consultNotes?: string | null;
  recurrenceRule?: AppointmentRecurrenceRule | null;
}

export type AppointmentUpdatePayload = Partial<AppointmentPayload>;

export interface AppointmentRecurrenceRule {
  frequency: "weekly" | "monthly";
  interval: number;
  count?: number | null;
  until?: string | null;
}

export type ContactSortBy = "name" | "source" | "status" | "value" | "lastContact" | "createdAt" | "updatedAt";
export type ContactSortOrder = "asc" | "desc";

export interface ContactRecord {
  id: string;
  accountName: string | null;
  role: string | null;
  communicationPermissions: {
    email: boolean;
    sms: boolean;
    whatsapp: boolean;
    phone: boolean;
  };
  firstName: string | null;
  lastName: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  roleTitle: string | null;
  emailPermission: boolean | null;
  phonePermission: boolean | null;
  smsPermission: boolean | null;
  whatsappPermission: boolean | null;
  website: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  tags: string[];
  status: string;
  leadStatus: string | null;
  source: string | null;
  value: number;
  treatmentInterests: string[];
  packageInterest: string | null;
  recommendedPackage: string | null;
  notes: string | null;
  externalId: string | null;
  importBatchId: string | null;
  lastContactAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContactListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  leadStatus?: string;
  source?: string;
  tag?: string;
  sortBy?: ContactSortBy;
  sortDir?: ContactSortOrder;
}

export interface ContactListResult {
  contacts: ContactRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ContactCreatePayload {
  accountName?: string | null;
  role?: string | null;
  communicationPermissions?: Partial<ContactRecord["communicationPermissions"]> | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  roleTitle?: string | null;
  emailPermission?: boolean | null;
  phonePermission?: boolean | null;
  smsPermission?: boolean | null;
  whatsappPermission?: boolean | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  tags?: string[];
  status?: string | null;
  leadStatus?: string | null;
  source?: string | null;
  value?: number | null;
  treatmentInterests?: string[];
  packageInterest?: string | null;
  recommendedPackage?: string | null;
  notes?: string | null;
}

export type ContactUpdatePayload = Partial<ContactCreatePayload>;

export interface ContactMutationResult {
  contact: ContactRecord;
  duplicateCandidates: ContactDuplicateCandidate[];
}

export interface ContactTimelineActivity {
  id: string;
  type: string;
  timestamp: string;
  userId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface ContactLinkedCall {
  id: string;
  direction: string | null;
  status: string | null;
  outcome: string | null;
  disposition: string | null;
  missedCall: boolean;
  duration: number;
  source: string | null;
  recordingUrl: string | null;
  notes: string | null;
  startedAt: string | null;
  createdAt: string;
}

export interface ContactLinkedAppointment {
  id: string;
  dateTime: string;
  status: string;
  treatment: string | null;
  value: number;
  clinicianName: string | null;
  noShowReason: string | null;
  consultNotes: string | null;
  createdAt: string;
}

export interface ContactLinkedFormSubmission {
  id: string;
  formId: string;
  formName: string;
  submittedAt: string;
  source: string | null;
  treatment: string | null;
  status: string | null;
  summary: string;
}

export interface ContactLinkedMessage {
  id: string;
  channel: "email" | "sms";
  direction: string | null;
  status: string | null;
  subject: string | null;
  preview: string;
  timestamp: string;
}

export interface ContactLinkedActivity {
  timeline: ContactTimelineActivity[];
  calls: ContactLinkedCall[];
  appointments: ContactLinkedAppointment[];
  forms: ContactLinkedFormSubmission[];
  messages: ContactLinkedMessage[];
  counts: {
    timeline: number;
    calls: number;
    appointments: number;
    forms: number;
    messages: number;
  };
}

export interface ContactImportRow {
  externalId?: string;
  accountName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  website?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  tags?: string[];
  status?: string;
  leadStatus?: string;
  source?: string;
  value?: number | string;
  treatmentInterests?: string[];
  packageInterest?: string;
  recommendedPackage?: string;
  notes?: string;
  lastContactAt?: string;
}

export interface ContactImportResult {
  batchId: string;
  status: "completed" | "completed_with_errors";
  totalRows: number;
  insertedRows: number;
  updatedRows: number;
  duplicateRows: number;
  errorRows: number;
  errors: Array<{
    rowNumber: number;
    message: string;
  }>;
}

export interface ContactImportBatch {
  id: string;
  filename: string | null;
  status: string;
  totalRows: number;
  insertedRows: number;
  updatedRows: number;
  duplicateRows: number;
  errorRows: number;
  createdAt: string;
  updatedAt: string;
}

export interface ContactDuplicateCandidate {
  id: string;
  existingContactId: string | null;
  candidateContactId: string | null;
  existingContact: ContactDuplicateContactSummary | null;
  candidateContact: ContactDuplicateContactSummary | null;
  matchType: string;
  score: number;
  status: string;
  candidateData: Record<string, unknown> | null;
  createdAt: string;
}

export interface ContactDuplicateContactSummary {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: string;
  createdAt: string;
}
