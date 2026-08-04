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
