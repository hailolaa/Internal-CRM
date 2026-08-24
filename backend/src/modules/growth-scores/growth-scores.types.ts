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

export interface GrowthScoreSnapshotPayload {
  contactId?: string | null;
  clientAccountProfileId?: string | null;
  auditId?: string | null;
  snapshotDate?: string | null;
  scoredAt?: string | null;
  overallScore?: number | string | null;
  overall?: number | string | null;
  categoryScores?: Partial<GrowthScoreCategories> | null;
  categories?: Partial<GrowthScoreCategories> | null;
  recommendedPackage?: string | null;
  gapSummary?: string | null;
  source?: string | null;
  notes?: string | null;
}

export interface GrowthScoreSnapshotRecord {
  id: string;
  clinicId: string;
  contactId: string | null;
  clientAccountProfileId: string | null;
  auditId: string | null;
  snapshotDate: string;
  scoredAt: string;
  overallScore: number | null;
  categoryScores: GrowthScoreCategories;
  recommendedPackage: string | null;
  gapSummary: string | null;
  source: string;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface GrowthScoreSnapshotListQuery {
  contactId?: string;
  clientAccountProfileId?: string;
  auditId?: string;
  limit?: number | string;
}

export interface GrowthScoreSnapshotListResponse {
  current: GrowthScoreSnapshotRecord | null;
  previous: GrowthScoreSnapshotRecord[];
  snapshots: GrowthScoreSnapshotRecord[];
}

export type GrowthScoreOutcomeType = "improved" | "stable" | "declined" | "won" | "lost" | "retained" | "churn_risk" | "other";

export interface GrowthScoreOutcomeFeedbackPayload {
  clientAccountProfileId: string;
  growthScoreSnapshotId?: string | null;
  feedbackDate?: string | null;
  outcomeType: GrowthScoreOutcomeType;
  scoreDelta?: number | string | null;
  note?: string | null;
}

export interface GrowthScoreOutcomeFeedbackRecord {
  id: string;
  clinicId: string;
  clientAccountProfileId: string;
  growthScoreSnapshotId: string | null;
  feedbackDate: string;
  outcomeType: GrowthScoreOutcomeType;
  scoreDelta: number | null;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface GrowthScorePortfolioRow {
  clinicId: string;
  clientAccountProfileId: string;
  clientName: string;
  clientStatus: string;
  healthStatus: string;
  currentPackage: string | null;
  currentScore: number | null;
  previousScore: number | null;
  scoreDelta: number | null;
  currentSnapshotDate: string | null;
  recommendedPackage: string | null;
  feedbackCount: number;
  lastFeedbackAt: string | null;
  lastOutcomeType: GrowthScoreOutcomeType | null;
}

export interface GrowthScorePortfolioResponse {
  generatedAt: string;
  scope: "current_clinic" | "all_clients";
  aggregate: {
    clients: number;
    clientsWithScores: number;
    averageScore: number | null;
    improved: number;
    declined: number;
    stable: number;
    feedbackItems: number;
  };
  trends: Array<{
    snapshotDate: string;
    averageScore: number | null;
    scoredClients: number;
  }>;
  clients: GrowthScorePortfolioRow[];
}
