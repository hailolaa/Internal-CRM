export type PlatformMetricPlatform =
  | "google_ads"
  | "ga4"
  | "google_business_profile"
  | "meta"
  | "seo"
  | "other";

export interface PlatformMetricRecord {
  id: string;
  platform: PlatformMetricPlatform;
  metricDate: string | null;
  campaign: string | null;
  locationLabel: string | null;
  metricName: string;
  metricValue: number;
  unit: string | null;
  attributionLabel: string | null;
  dataSource: "manual" | "manual_or_unknown" | `connector:${string}`;
  rawPayload: Record<string, unknown> | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformMetricListParams {
  aggregate?: "campaign";
  campaign?: string;
  from?: string;
  metricName?: string;
  platform?: string;
  to?: string;
}

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

export interface FreelancerReportTemplateRecord {
  workType: FreelancerReportWorkType;
  label: string;
  requiredMetrics: string[];
  requiredEvidence: string[];
  qaChecks: string[];
}

export interface FreelancerReportMetricRecord {
  name: string;
  value: string | number;
  unit?: string | null;
  baseline?: string | number | null;
  target?: string | number | null;
}

export interface FreelancerReportEvidenceRecord {
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

export interface FreelancerReportRecord {
  id: string;
  workType: FreelancerReportWorkType;
  sourceEventId: string | null;
  reportTitle: string;
  accountLabel: string | null;
  reportingPeriodStart: string | null;
  reportingPeriodEnd: string | null;
  metrics: FreelancerReportMetricRecord[];
  evidence: FreelancerReportEvidenceRecord[];
  risks: string[];
  recommendedActions: string[];
  sourceLinks: string[];
  qaStatus: FreelancerReportQaStatus;
  qaNotes: string | null;
  highRiskChange: boolean;
  reviewerId: string | null;
  verificationDate: string | null;
  needsRework: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FreelancerReportSummaryRecord {
  total: number;
  awaitingEvidence: number;
  awaitingQa: number;
  accepted: number;
  failedQa: number;
  rejected: number;
  reworkRate: number;
  workTypesCovered: FreelancerReportWorkType[];
}

export interface FreelancerReportListResponse {
  reports: FreelancerReportRecord[];
  summary: FreelancerReportSummaryRecord;
}

export interface FreelancerReportListParams {
  qaStatus?: FreelancerReportQaStatus;
  workType?: FreelancerReportWorkType;
}
