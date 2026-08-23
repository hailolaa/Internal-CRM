export type AnalyticsDataState = "live" | "demo" | "preview" | "partial" | "provider_dependent" | "roadmap";
export type AnalyticsDimensionStatus = "active" | "archived";
export type AnalyticsMetricGrain = "event" | "daily" | "weekly" | "monthly" | "quarterly" | "annual";
export type AnalyticsMetricProvenance = "exact" | "manual" | "connector" | "estimated" | "unknown";

export interface AnalyticsDimensionInput {
  clinicId: string;
  dimensionType: string;
  dimensionKey: string;
  label: string;
  dataState?: AnalyticsDataState;
  status?: AnalyticsDimensionStatus;
  metadata?: Record<string, unknown> | null;
}

export interface AnalyticsDimensionRecord {
  id: string;
  clinicId: string;
  dimensionType: string;
  dimensionKey: string;
  label: string;
  dataState: AnalyticsDataState;
  status: AnalyticsDimensionStatus;
}

export interface AnalyticsFactInput {
  clinicId: string;
  metricKey: string;
  grain: AnalyticsMetricGrain;
  grainDate: string;
  metricValue: number;
  unit?: string;
  dimensions: Record<string, string | number | boolean | null>;
  provenance?: AnalyticsMetricProvenance;
  sourceId?: string | null;
  sourceEventId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface AnalyticsFactRecord {
  id: string;
  clinicId: string;
  metricKey: string;
  grain: AnalyticsMetricGrain;
  grainDate: string;
  metricValue: number;
  unit: string;
  dimensionHash: string;
  dimensions: Record<string, unknown>;
  provenance: AnalyticsMetricProvenance;
  sourceId: string | null;
  sourceEventId: string | null;
  lineageHash: string;
}

export interface AnalyticsSnapshotInput {
  clinicId: string;
  snapshotKey: string;
  asOfDate: string;
  metricSet: Record<string, unknown>;
  sourceWatermark?: Record<string, unknown> | null;
  createdBySourceId?: string | null;
}

export interface AnalyticsSnapshotRecord {
  id: string;
  clinicId: string;
  snapshotKey: string;
  asOfDate: string;
  metricSet: Record<string, unknown>;
  sourceWatermark: Record<string, unknown> | null;
  lineageHash: string;
  createdBySourceId: string | null;
}
