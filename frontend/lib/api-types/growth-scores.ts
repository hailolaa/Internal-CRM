export interface GrowthScoreHistoryCategories {
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

export interface GrowthScoreSnapshotRecord {
  id: string;
  clinicId: string;
  contactId: string | null;
  clientAccountProfileId: string | null;
  auditId: string | null;
  snapshotDate: string;
  scoredAt: string;
  overallScore: number | null;
  categoryScores: GrowthScoreHistoryCategories;
  recommendedPackage: string | null;
  gapSummary: string | null;
  source: string;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface GrowthScoreSnapshotList {
  current: GrowthScoreSnapshotRecord | null;
  previous: GrowthScoreSnapshotRecord[];
  snapshots: GrowthScoreSnapshotRecord[];
}

export interface GrowthScoreSnapshotPayload {
  contactId?: string | null;
  clientAccountProfileId?: string | null;
  auditId?: string | null;
  snapshotDate?: string | null;
  scoredAt?: string | null;
  overallScore?: number | null;
  categoryScores?: Partial<GrowthScoreHistoryCategories> | null;
  recommendedPackage?: string | null;
  gapSummary?: string | null;
  source?: string | null;
  notes?: string | null;
}
