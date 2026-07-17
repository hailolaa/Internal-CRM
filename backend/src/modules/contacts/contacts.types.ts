import type { AuditWorkflowStatus } from "../audit-workflow/audit-workflow.constants.js";

export type ContactImportMode = "create_only" | "upsert";

export type ContactSortBy = "name" | "source" | "status" | "value" | "lastContact" | "createdAt" | "updatedAt";
export type ContactSortOrder = "asc" | "desc";
export type ContactAuditWorkflowFilter = "due" | "overdue" | "in_progress" | "completed";

export interface ContactCommunicationPermissions {
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
  phone: boolean;
}

export interface GrowthScoreCategories {
  websiteVisibility: number | null;
  seo: number | null;
  gbp: number | null;
  tracking: number | null;
  conversion: number | null;
  leadHandling: number | null;
  responseSpeed: number | null;
  enquiryVisibility: number | null;
  treatmentPerformance: number | null;
  revenueLeakage: number | null;
  growthOpportunity: number | null;
}

export interface GrowthScoreSnapshot {
  overall: number | null;
  categories: GrowthScoreCategories;
  recommendedPackage: string | null;
  gapSummary: string | null;
  updatedAt: string | null;
}

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
  leadStatus?: string;
  auditStatus?: AuditWorkflowStatus;
  auditWorkflow?: ContactAuditWorkflowFilter;
  createdFrom?: string;
  createdTo?: string;
  sortBy?: ContactSortBy;
  sortOrder?: ContactSortOrder;
  sortDir?: ContactSortOrder;
}

export interface ContactMutationDTO {
  externalId?: string | null;
  accountName?: string | null;
  role?: string | null;
  communicationPermissions?: Partial<ContactCommunicationPermissions> | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  roleTitle?: string | null;
  canEmail?: boolean | null;
  canCall?: boolean | null;
  canWhatsAppMessage?: boolean | null;
  emailPermission?: boolean | null;
  phonePermission?: boolean | null;
  smsPermission?: boolean | null;
  whatsappPermission?: boolean | null;
  unsubscribed?: boolean | null;
  doNotContact?: boolean | null;
  permissionSource?: string | null;
  optInAt?: string | null;
  optOutAt?: string | null;
  consentUpdatedAt?: string | null;
  website?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  tags?: string[];
  status?: string | null;
  leadStatus?: string | null;
  source?: string | null;
  firstSource?: string | null;
  latestSource?: string | null;
  convertingSource?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  landingPage?: string | null;
  referrer?: string | null;
  formSubmitted?: string | null;
  pageSubmitted?: string | null;
  ctaClicked?: string | null;
  gclid?: string | null;
  fbclid?: string | null;
  msclkid?: string | null;
  ttclid?: string | null;
  gbraid?: string | null;
  wbraid?: string | null;
  value?: number | string | null;
  treatmentInterests?: string[];
  packageInterest?: string | null;
  recommendedPackage?: string | null;
  growthScore?: Partial<GrowthScoreSnapshot> | null;
  growthScoreOverall?: number | string | null;
  growthScoreCategories?: Partial<GrowthScoreCategories> | null;
  growthScoreRecommendedPackage?: string | null;
  growthScoreGapSummary?: string | null;
  growthScoreUpdatedAt?: string | null;
  auditStatus?: AuditWorkflowStatus | null;
  auditAssignedTo?: string | null;
  auditFollowUpDueAt?: string | null;
  auditStatusUpdatedAt?: string | null;
  notes?: string | null;
  lastContactAt?: string | null;
}

export type CreateContactDTO = ContactMutationDTO;
export type UpdateContactDTO = Partial<ContactMutationDTO>;

export interface NormalizedContactData {
  externalId: string | null;
  accountName: string | null;
  role: string | null;
  communicationPermissions: ContactCommunicationPermissions;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  roleTitle: string | null;
  canEmail: boolean | null;
  canCall: boolean | null;
  canWhatsAppMessage: boolean | null;
  emailPermission: boolean | null;
  phonePermission: boolean | null;
  smsPermission: boolean | null;
  whatsappPermission: boolean | null;
  unsubscribed: boolean | null;
  doNotContact: boolean | null;
  permissionSource: string | null;
  optInAt: string | null;
  optOutAt: string | null;
  consentUpdatedAt: string | null;
  website: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  tags: string[];
  status: string | null;
  leadStatus: string | null;
  source: string | null;
  firstSource: string | null;
  latestSource: string | null;
  convertingSource: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  landingPage: string | null;
  referrer: string | null;
  formSubmitted: string | null;
  pageSubmitted: string | null;
  ctaClicked: string | null;
  gclid: string | null;
  fbclid: string | null;
  msclkid: string | null;
  ttclid: string | null;
  gbraid: string | null;
  wbraid: string | null;
  value: number | null;
  treatmentInterests: string[];
  packageInterest: string | null;
  recommendedPackage: string | null;
  growthScore: GrowthScoreSnapshot;
  growthScoreOverall: number | null;
  growthScoreCategories: GrowthScoreCategories;
  growthScoreRecommendedPackage: string | null;
  growthScoreGapSummary: string | null;
  growthScoreUpdatedAt: string | null;
  auditStatus: AuditWorkflowStatus | null;
  auditAssignedTo: string | null;
  auditFollowUpDueAt: string | null;
  auditStatusUpdatedAt: string | null;
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
  accountName: string | null;
  role: string | null;
  communicationPermissions: ContactCommunicationPermissions;
  firstName: string | null;
  lastName: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  roleTitle: string | null;
  canEmail: boolean | null;
  canCall: boolean | null;
  canWhatsAppMessage: boolean | null;
  emailPermission: boolean | null;
  phonePermission: boolean | null;
  smsPermission: boolean | null;
  whatsappPermission: boolean | null;
  unsubscribed: boolean | null;
  doNotContact: boolean | null;
  permissionSource: string | null;
  optInAt: string | null;
  optOutAt: string | null;
  consentUpdatedAt: string | null;
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
  firstSource: string | null;
  latestSource: string | null;
  convertingSource: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  landingPage: string | null;
  referrer: string | null;
  formSubmitted: string | null;
  pageSubmitted: string | null;
  ctaClicked: string | null;
  gclid: string | null;
  fbclid: string | null;
  msclkid: string | null;
  ttclid: string | null;
  gbraid: string | null;
  wbraid: string | null;
  value: number;
  treatmentInterests: string[];
  packageInterest: string | null;
  recommendedPackage: string | null;
  growthScore: GrowthScoreSnapshot;
  growthScoreOverall: number | null;
  growthScoreCategories: GrowthScoreCategories;
  growthScoreRecommendedPackage: string | null;
  growthScoreGapSummary: string | null;
  growthScoreUpdatedAt: string | null;
  auditStatus: AuditWorkflowStatus | null;
  auditAssignedTo: string | null;
  auditFollowUpDueAt: string | null;
  auditStatusUpdatedAt: string | null;
  notes: string | null;
  externalId: string | null;
  importBatchId: string | null;
  lastContactAt: string | null;
  nextFollowUpAt: string | null;
  contactAttemptCount: number;
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

export interface ContactLinkedSalesCallDemo {
  id: string;
  booked: boolean;
  scheduledAt: string | null;
  type: string;
  packageInterest: string | null;
  attended: boolean;
  noShow: boolean;
  rescheduled: boolean;
  outcome: string | null;
  nextStep: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
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
  salesCallDemos: ContactLinkedSalesCallDemo[];
  appointments: ContactLinkedAppointment[];
  forms: ContactLinkedFormSubmission[];
  messages: ContactLinkedMessage[];
  deposits: ContactLinkedDeposit[];
  tasks: ContactLinkedTask[];
  counts: {
    timeline: number;
    calls: number;
    salesCallDemos: number;
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
  recordType: "call" | "message" | "form" | "booking" | "deposit" | "task" | "note" | "contact_attempt";
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

export interface AddContactNoteDTO {
  note: string;
}

export interface RecordContactAttemptDTO {
  channel: "call" | "email" | "sms" | "whatsapp" | "other";
  outcome?: string | null;
  notes?: string | null;
  attemptedAt?: string | null;
}

export interface RecordSalesCallDemoDTO {
  booked?: boolean | null;
  scheduledAt?: string | null;
  type?: string | null;
  packageInterest?: string | null;
  attended?: boolean | null;
  noShow?: boolean | null;
  rescheduled?: boolean | null;
  outcome?: string | null;
  nextStep?: string | null;
  notes?: string | null;
}

export interface ContactDrawerActionResult {
  action: string;
  record: Record<string, unknown> | null;
  activity: ContactLinkedActivityResponse;
}

export interface ContactImportRow {
  externalId?: string;
  accountName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  roleTitle?: string;
  canEmail?: boolean;
  canCall?: boolean;
  canWhatsAppMessage?: boolean;
  emailPermission?: boolean;
  phonePermission?: boolean;
  smsPermission?: boolean;
  whatsappPermission?: boolean;
  unsubscribed?: boolean;
  doNotContact?: boolean;
  permissionSource?: string;
  optInAt?: string;
  optOutAt?: string;
  consentUpdatedAt?: string;
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
  firstSource?: string;
  latestSource?: string;
  convertingSource?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  landingPage?: string;
  referrer?: string;
  formSubmitted?: string;
  pageSubmitted?: string;
  ctaClicked?: string;
  gclid?: string;
  fbclid?: string;
  msclkid?: string;
  ttclid?: string;
  gbraid?: string;
  wbraid?: string;
  value?: number | string;
  treatmentInterests?: string[];
  packageInterest?: string;
  recommendedPackage?: string;
  growthScore?: Partial<GrowthScoreSnapshot>;
  growthScoreOverall?: number | string;
  growthScoreCategories?: Partial<GrowthScoreCategories>;
  growthScoreRecommendedPackage?: string;
  growthScoreGapSummary?: string;
  growthScoreUpdatedAt?: string;
  auditStatus?: AuditWorkflowStatus;
  auditAssignedTo?: string;
  auditFollowUpDueAt?: string;
  auditStatusUpdatedAt?: string;
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
