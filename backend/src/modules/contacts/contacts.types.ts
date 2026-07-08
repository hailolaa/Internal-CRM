export type ContactImportMode = "create_only" | "upsert";

export type ContactSortBy = "name" | "source" | "status" | "value" | "lastContact" | "createdAt" | "updatedAt";
export type ContactSortOrder = "asc" | "desc";

export interface ContactListQuery {
  page?: number;
  limit?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  source?: string;
  tag?: string;
  campaign?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  createdFrom?: string;
  createdTo?: string;
  sortBy?: ContactSortBy;
  sortOrder?: ContactSortOrder;
  sortDir?: ContactSortOrder;
}

export interface ContactMutationDTO {
  externalId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  tags?: string[];
  status?: string | null;
  source?: string | null;
  value?: number | string | null;
  treatmentInterests?: string[];
  notes?: string | null;
  lastContactAt?: string | null;
}

export type CreateContactDTO = ContactMutationDTO;
export type UpdateContactDTO = Partial<ContactMutationDTO>;

export interface NormalizedContactData {
  externalId: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  tags: string[];
  status: string | null;
  source: string | null;
  value: number | null;
  treatmentInterests: string[];
  notes: string | null;
  lastContactAt: string | null;
}

export interface NormalizedImportContactData extends NormalizedContactData {
  status: string;
  source: string;
}

export interface DuplicateContactMatch {
  existingContactId: string;
  matchType: string;
  score: number;
}

export interface ContactResponse {
  id: string;
  firstName: string | null;
  lastName: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  tags: string[];
  status: string;
  source: string | null;
  value: number;
  treatmentInterests: string[];
  notes: string | null;
  externalId: string | null;
  importBatchId: string | null;
  lastContactAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContactListResponse {
  contacts: ContactResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ContactMutationResponse {
  contact: ContactResponse;
  duplicateCandidates: DuplicateCandidateResponse[];
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
  href: string;
  actions: string[];
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
  href: string;
  actions: string[];
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
  href: string;
  actions: string[];
}

export interface ContactLinkedMessage {
  id: string;
  channel: "email" | "sms";
  direction: string | null;
  status: string | null;
  subject: string | null;
  preview: string;
  timestamp: string;
  href: string;
  actions: string[];
}

export interface ContactLinkedDeposit {
  id: string;
  contact: string;
  appointmentId: string | null;
  treatment: string;
  appointmentDate: string | null;
  depositAmount: number;
  depositPaid: boolean;
  paidDate: string | null;
  method: string | null;
  status: string;
  paymentStatus: string | null;
  href: string;
  actions: string[];
}

export interface ContactLinkedTask {
  id: string;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high";
  status: "pending" | "completed";
  category: string | null;
  due: string | null;
  dueDate: string | null;
  assignedTo: string | null;
  href: string;
  actions: string[];
}

export interface ContactLinkedActivityResponse {
  timeline: ContactTimelineActivity[];
  calls: ContactLinkedCall[];
  appointments: ContactLinkedAppointment[];
  forms: ContactLinkedFormSubmission[];
  messages: ContactLinkedMessage[];
  deposits: ContactLinkedDeposit[];
  tasks: ContactLinkedTask[];
  counts: {
    timeline: number;
    calls: number;
    appointments: number;
    forms: number;
    messages: number;
    deposits: number;
    tasks: number;
  };
  actions: ContactDrawerActionState[];
}

export interface ContactDrawerActionState {
  key: string;
  label: string;
  recordType: "call" | "message" | "form" | "booking" | "deposit" | "task";
  method: "GET" | "POST" | "PATCH";
  path: string;
  requiredPermission: string;
  enabled: boolean;
  reason: string | null;
}

export interface ContactDrawerActionContext {
  userId: string;
  permissions?: Record<string, boolean>;
}

export interface SendContactMessageTemplateDTO {
  templateId: string;
  channel?: "email" | "sms";
  sendNow?: boolean;
  variables?: Record<string, unknown>;
}

export interface ContactDrawerActionResult {
  action: string;
  record: Record<string, unknown> | null;
  activity: ContactLinkedActivityResponse;
}

export interface ContactImportRow {
  externalId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  tags?: string[];
  status?: string;
  source?: string;
  value?: number | string;
  treatmentInterests?: string[];
  notes?: string;
  lastContactAt?: string;
}

export interface ContactImportRequest {
  filename?: string;
  mode?: ContactImportMode;
  rows?: ContactImportRow[];
  sourceUrl?: string | null;
}

export interface ContactImportPreviewRequest {
  sourceUrl: string;
}

export interface ContactImportPreviewResponse {
  filename: string;
  rows: ContactImportRow[];
}

export interface ContactImportResponse {
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

export interface ContactImportBatchResponse {
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

export interface DuplicateCandidateContactSummary {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: string;
  createdAt: string;
}

export interface DuplicateCandidateResponse {
  id: string;
  existingContactId: string | null;
  candidateContactId: string | null;
  existingContact: DuplicateCandidateContactSummary | null;
  candidateContact: DuplicateCandidateContactSummary | null;
  matchType: string;
  score: number;
  status: string;
  candidateData: Record<string, unknown> | null;
  createdAt: string;
}
