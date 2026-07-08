export type ManualMetricPlatform =
  | "google_ads"
  | "ga4"
  | "google_business_profile"
  | "meta"
  | "seo"
  | "other";

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
