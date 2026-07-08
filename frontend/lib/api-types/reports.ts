export interface MonthlyReportSections {
  executiveSummary: string;
  highlights: string[];
  recommendations: string[];
  risks: string[];
}

export interface MonthlyReportData {
  generatedAt: string;
  month: string;
  range: DashboardRange;
  sections: MonthlyReportSections;
  metrics?: Record<string, unknown>;
}

export type ReportWorkflowStatus = "draft" | "in_review" | "approved" | "published";

export interface ReportRecord {
  id: string;
  name: string;
  type: string | null;
  description: string | null;
  filters: Record<string, unknown>;
  data: Record<string, unknown>;
  workflowStatus: ReportWorkflowStatus;
  internalNotes: string | null;
  clientCommentary: string | null;
  aiDraftSummary: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportWorkflowUpdatePayload {
  workflowStatus?: ReportWorkflowStatus;
  internalNotes?: string | null;
  clientCommentary?: string | null;
  aiDraftSummary?: string | null;
}

export interface ReportShareRecord {
  id: string;
  reportId: string;
  token: string;
  createdAt: string;
}

export interface DashboardRecord {
  id: string;
  name: string;
  description: string | null;
  layout: Record<string, unknown>;
  widgets: unknown[];
  createdAt: string;
  updatedAt: string;
}

export interface DashboardRange {
  startDate: string;
  endDate: string;
}

export interface DashboardSummaryRecord {
  range: DashboardRange;
  cards: {
    leads: number;
    activities: number;
    totalCalls: number;
    missedCalls: number;
    appointments: number;
    noShows: number;
    consults: number;
    bookedConsults: number;
    attendedConsults: number;
    soldTreatments: number;
    activeTreatmentPlans: number;
    openDeals: number;
    depositsPaid: number;
  };
  financials: {
    leadValue: number;
    leadValueProvenance?: string;
    treatmentPlanValue: number;
    openDealValue: number;
    wonDealValue: number;
    consultRevenue: number;
    consultRevenueProvenance?: string;
    depositRevenue: number;
    depositRevenueProvenance?: string;
    totalRevenue: number;
    spend: number;
    spendProvenance?: string;
    roas: number;
    costPerLead: number;
    costPerBookedConsult: number;
    costPerAttendedConsult: number;
    costPerSoldTreatment: number;
  };
  emptyState: boolean;
}

export interface DashboardFunnelRecord {
  range: DashboardRange;
  funnel: Array<{
    key: string;
    label: string;
    count: number;
    rate: number;
  }>;
  provenance?: Record<string, string>;
  conversionRates: {
    leadToContactRate: number;
    leadToBookedRate: number;
    bookedToAttendedRate: number;
    attendedToSoldRate: number;
  };
  emptyState: boolean;
}

export interface BenchmarkSummaryRecord {
  clinicId: string;
  counts: {
    leads: number;
    calls: number;
    consults: number;
  };
  minimumThresholds: {
    leads: number;
    calls: number;
    consults: number;
  };
  cohortStatus: string;
  safeWording: string;
  metrics: Array<{
    key: string;
    label: string;
    value: number;
    unit: "percent" | "minutes" | "currency";
    benchmarkAverage: number;
    topQuartile: number;
    gapToAverage: number;
    enoughData: boolean;
    minimumThreshold: number;
    currentCount: number;
    wording: string;
    benchmarkSource: "estimated";
  }>;
}

export interface RevenueByChannelRecord {
  range: DashboardRange;
  totals: {
    spend: number;
    revenue: number;
    roas: number;
    costPerLead: number;
    costPerBookedConsult: number;
    costPerAttendedConsult: number;
    costPerSoldTreatment: number;
    provenance?: Record<string, string>;
  };
  bySource: Array<{
    source: string | null;
    channel: string | null;
    campaign?: string | null;
    spend: number;
    leads: number;
    bookedConsults: number;
    attendedConsults: number;
    soldTreatments: number;
    revenue: number;
    roas: number;
    costPerLead: number;
    attribution?: string | null;
    provenance?: Record<string, string>;
  }>;
  byCampaign: Array<{
    source: string | null;
    channel: string | null;
    campaign: string | null;
    spend: number;
    leads: number;
    bookedConsults: number;
    attendedConsults: number;
    soldTreatments: number;
    revenue: number;
    roas: number;
    costPerLead: number;
    attribution?: string | null;
    provenance?: Record<string, string>;
  }>;
  emptyState: boolean;
}

export interface RevenueByTreatmentRecord {
  range: DashboardRange;
  totals: {
    soldTreatments: number;
    revenue: number;
    provenance?: Record<string, string>;
  };
  byTreatment: Array<{
    treatment: string;
    category: string;
    soldTreatments: number;
    revenue: number;
    averageRevenue: number;
    averageValueCents: number;
    marginPercent: number;
    isHighTicket: boolean;
    provenance?: Record<string, string>;
  }>;
  emptyState: boolean;
}

export interface RevenueLeakItemRecord {
  key: string;
  label: string;
  count: number;
  estimatedRisk: number;
  provenance?: Record<string, string>;
}

export interface RevenueLeaksRecord {
  range: DashboardRange;
  items: RevenueLeakItemRecord[];
  totalEstimatedRisk: number;
  emptyState: boolean;
}

export type RevenueLeakDetailKey =
  | "lowConsultConversion"
  | "missedCalls"
  | "noShows"
  | "slaBreaches";

export interface RevenueLeakDetailRecord {
  id: string;
  leakKey: RevenueLeakDetailKey;
  sourceType: "appointment" | "call" | "contact";
  sourceId: string;
  contactId: string | null;
  contactName: string;
  contactPhone: string | null;
  source: string;
  treatment: string;
  ownerName: string;
  occurredAt: string | null;
  estimatedRisk: number;
  riskLabel: "estimated";
  status: string;
  reason: string;
  nextAction: string;
  context?: {
    actionTaskId: string | null;
    actionTaskStatus: string | null;
    contactActivityCount: number;
    insightId: string | null;
    insightStatus: string | null;
    latestAppointmentId: string | null;
    latestCallId: string | null;
    latestFormSubmissionId: string | null;
    leadHref: string | null;
    linkedAppointmentCount: number;
    linkedCallCount: number;
    linkedFormSubmissionCount: number;
    linkedMessageCount: number;
    monthlyActionPlanItemId: string | null;
    monthlyActionPlanItemStatus: string | null;
  };
}

export interface RevenueLeakDetailsRecord {
  range: DashboardRange;
  items: Record<RevenueLeakDetailKey, RevenueLeakDetailRecord[]>;
  counts: Record<RevenueLeakDetailKey, number>;
  emptyState: boolean;
}

export interface TopOpportunityDealRecord {
  id: string;
  title: string;
  contactName: string;
  treatment: string | null;
  valueCents: number;
  probability: number;
  status: string;
  stageName: string | null;
  ownerName: string | null;
  priorityScore: number;
}

export interface TopOpportunitiesRecord {
  range: DashboardRange;
  summary: {
    averageDealValueCents: number;
    dealsCount: number;
    totalValueCents: number;
  };
  deals: TopOpportunityDealRecord[];
  emptyState: boolean;
}

export interface CampaignMetricRecord {
  source: string | null;
  channel: string | null;
  campaign: string | null;
  period: string;
  spend: number;
  leads: number;
  bookedConsults: number;
  attendedConsults: number;
  soldTreatments: number;
  revenue: number;
  roas: number;
  costPerLead: number;
  costPerBookedConsult: number;
  costPerAttendedConsult: number;
  costPerSoldTreatment: number;
  attribution: string;
}

export interface RoasMetricsRecord {
  spend: number;
  revenue: number;
  roas: number;
  costPerLead: number;
  costPerBookedConsult: number;
  costPerAttendedConsult: number;
  costPerSoldTreatment: number;
  attribution: string;
  byCampaign: CampaignMetricRecord[];
}
