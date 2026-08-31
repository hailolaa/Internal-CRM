export type ManualMetricPlatform =
  | "google_ads"
  | "ga4"
  | "google_business_profile"
  | "meta"
  | "seo"
  | "other";

export type FreelancerReportWorkType =
  | "ppc"
  | "seo"
  | "gbp"
  | "wordpress_development"
  | "design_video"
  | "reporting";

export type FreelancerReportQaStatus =
  | "awaiting_evidence"
  | "awaiting_qa"
  | "accepted"
  | "failed_qa"
  | "rejected";

export interface IngestLeadDTO {
  email?: string | null;
  eventId?: string | null;
  firstName?: string | null;
  fullName?: string | null;
  lastName?: string | null;
  notes?: string | null;
  phone?: string | null;
  rawPayload?: Record<string, unknown> | null;
  source?: string | null;
  status?: string | null;
  treatmentInterest?: string | null;
  treatmentInterests?: string[];
  value?: number | null;
}

export interface ManualPlatformMetricDTO {
  platform: ManualMetricPlatform;
  metricDate: string;
  metricName: string;
  metricValue: number;
  attributionLabel?: string | null;
  campaign?: string | null;
  locationLabel?: string | null;
  notes?: string | null;
  rawPayload?: Record<string, unknown> | null;
  unit?: string | null;
}

export interface ManualPlatformMetricQuery {
  campaign?: string;
  from?: string;
  metricName?: string;
  platform?: ManualMetricPlatform;
  to?: string;
}

export interface SummaryPreviewDTO {
  context: Record<string, unknown>;
  promptType?: string | null;
}

export interface FreelancerReportMetricDTO {
  name: string;
  value: string | number;
  unit?: string | null;
  baseline?: string | number | null;
  target?: string | number | null;
}

export interface FreelancerReportEvidenceDTO {
  label: string;
  url?: string | null;
  screenshotUrl?: string | null;
  beforeValue?: string | number | null;
  afterValue?: string | number | null;
  workPerformed?: string | null;
  rationale?: string | null;
  expectedResult?: string | null;
  accountOrPage?: string | null;
}

export interface FreelancerReportReviewDTO {
  workType: FreelancerReportWorkType;
  reportTitle: string;
  reportingPeriodStart: string;
  reportingPeriodEnd: string;
  accountLabel?: string | null;
  sourceEventId?: string | null;
  metrics: FreelancerReportMetricDTO[];
  evidence: FreelancerReportEvidenceDTO[];
  risks?: string[];
  recommendedActions?: string[];
  sourceLinks?: string[];
  qaStatus?: FreelancerReportQaStatus;
  qaNotes?: string | null;
  highRiskChange?: boolean;
  reviewerId?: string | null;
  verificationDate?: string | null;
}

export interface FreelancerReportReviewQuery {
  qaStatus?: FreelancerReportQaStatus;
  workType?: FreelancerReportWorkType;
}
