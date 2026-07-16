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
