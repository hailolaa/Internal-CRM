export type UnifiedMetricUnit = "count" | "currency" | "percentage" | "minutes" | "ratio";
export type UnifiedMetricCategory = "traffic" | "lead" | "call" | "booking" | "sales" | "finance" | "operations" | "calculated";
export type UnifiedDimensionKey =
  | "client"
  | "location"
  | "treatment"
  | "campaign"
  | "source_channel"
  | "time_period"
  | "workstream_owner";

export interface UnifiedMetricDefinition {
  key: string;
  label: string;
  unit: UnifiedMetricUnit;
  category: UnifiedMetricCategory;
  sourceRequirement: "connector" | "manual_or_connector" | "calculated";
  nullableWhenMissing: boolean;
  dimensions: UnifiedDimensionKey[];
}

export interface RatioInput {
  numerator: number | null | undefined;
  denominator: number | null | undefined;
}

export interface CommercialRevenueLeakageInput {
  missedCalls?: number | null;
  slowResponseLeads?: number | null;
  noShows?: number | null;
  averageTreatmentValue?: number | null;
  slowResponseDropoutRate?: number | null;
}

export interface CommercialRevenueLeakageResult {
  total: number | null;
  unit: "currency";
  components: {
    missedCalls: number | null;
    slowResponse: number | null;
    noShows: number | null;
  };
  missingInputs: string[];
}

export const UNIFIED_DIMENSIONS: Array<{ key: UnifiedDimensionKey; label: string }> = [
  { key: "client", label: "Client / clinic" },
  { key: "location", label: "Location" },
  { key: "treatment", label: "Treatment / service" },
  { key: "campaign", label: "Campaign" },
  { key: "source_channel", label: "Source / channel" },
  { key: "time_period", label: "Time period" },
  { key: "workstream_owner", label: "Workstream owner" },
];

const COMMON_DIMENSIONS: UnifiedDimensionKey[] = ["client", "location", "treatment", "campaign", "source_channel", "time_period"];
const CLIENT_TIME_DIMENSIONS: UnifiedDimensionKey[] = ["client", "location", "time_period"];

export const UNIFIED_METRICS: UnifiedMetricDefinition[] = [
  metric("impressions", "Impressions", "count", "traffic", "connector", COMMON_DIMENSIONS),
  metric("clicks", "Clicks", "count", "traffic", "connector", COMMON_DIMENSIONS),
  metric("spend", "Spend", "currency", "traffic", "connector", COMMON_DIMENSIONS),
  metric("leads", "Leads", "count", "lead", "connector", COMMON_DIMENSIONS),
  metric("qualified_leads", "Qualified leads", "count", "lead", "manual_or_connector", COMMON_DIMENSIONS),
  metric("calls_answered", "Answered calls", "count", "call", "connector", ["client", "location", "source_channel", "time_period"]),
  metric("calls_missed", "Missed calls", "count", "call", "connector", ["client", "location", "source_channel", "time_period"]),
  metric("calls_returned", "Returned calls", "count", "call", "connector", ["client", "location", "source_channel", "time_period"]),
  metric("bookings", "Bookings", "count", "booking", "manual_or_connector", COMMON_DIMENSIONS),
  metric("consultations_attended", "Consultations attended", "count", "booking", "manual_or_connector", COMMON_DIMENSIONS),
  metric("treatment_sales_count", "Treatment sales count", "count", "sales", "manual_or_connector", CLIENT_TIME_DIMENSIONS),
  metric("treatment_sales_value", "Treatment sales value", "currency", "sales", "manual_or_connector", CLIENT_TIME_DIMENSIONS),
  metric("revenue", "Revenue", "currency", "finance", "manual_or_connector", CLIENT_TIME_DIMENSIONS),
  metric("cancellation_rate", "Cancellation rate", "percentage", "operations", "calculated", CLIENT_TIME_DIMENSIONS),
  metric("no_show_rate", "No-show rate", "percentage", "operations", "calculated", CLIENT_TIME_DIMENSIONS),
  metric("lead_response_speed_minutes", "Lead response speed", "minutes", "operations", "manual_or_connector", ["client", "location", "source_channel", "time_period", "workstream_owner"]),
  metric("reception_follow_up_performance", "Reception / follow-up performance", "percentage", "operations", "calculated", ["client", "location", "time_period", "workstream_owner"]),
  metric("conversion_lead_to_qualified", "Lead to qualified conversion", "percentage", "calculated", "calculated", COMMON_DIMENSIONS),
  metric("conversion_qualified_to_booking", "Qualified to booking conversion", "percentage", "calculated", "calculated", COMMON_DIMENSIONS),
  metric("conversion_booking_to_consultation", "Booking to consultation conversion", "percentage", "calculated", "calculated", COMMON_DIMENSIONS),
  metric("conversion_consultation_to_treatment", "Consultation to treatment conversion", "percentage", "calculated", "calculated", COMMON_DIMENSIONS),
  metric("cost_per_lead", "Cost per lead", "currency", "calculated", "calculated", COMMON_DIMENSIONS),
  metric("cost_per_qualified_lead", "Cost per qualified lead", "currency", "calculated", "calculated", COMMON_DIMENSIONS),
  metric("cost_per_booking", "Cost per booking", "currency", "calculated", "calculated", COMMON_DIMENSIONS),
  metric("cost_per_acquired_patient", "Cost per acquired patient", "currency", "calculated", "calculated", COMMON_DIMENSIONS),
  metric("roas", "ROAS", "ratio", "calculated", "calculated", COMMON_DIMENSIONS),
  metric("marketing_roi", "Marketing ROI", "percentage", "calculated", "calculated", COMMON_DIMENSIONS),
  metric("commercial_revenue_leakage", "Commercial revenue leakage", "currency", "calculated", "calculated", CLIENT_TIME_DIMENSIONS),
];

export function getUnifiedMetricDefinition(key: string) {
  return UNIFIED_METRICS.find((metricDefinition) => metricDefinition.key === normalizeMetricKey(key)) || null;
}

export function calculateRatio({ numerator, denominator }: RatioInput): number | null {
  if (!isFiniteNumber(numerator) || !isFiniteNumber(denominator) || denominator <= 0) return null;
  return roundMetric((numerator / denominator) * 100);
}

export function calculateCostPer(spend: number | null | undefined, count: number | null | undefined): number | null {
  if (!isFiniteNumber(spend) || !isFiniteNumber(count) || count <= 0) return null;
  return roundMetric(spend / count);
}

export function calculateRoas(revenue: number | null | undefined, spend: number | null | undefined): number | null {
  if (!isFiniteNumber(revenue) || !isFiniteNumber(spend) || spend <= 0) return null;
  return roundMetric(revenue / spend);
}

export function calculateMarketingRoi(revenue: number | null | undefined, spend: number | null | undefined): number | null {
  if (!isFiniteNumber(revenue) || !isFiniteNumber(spend) || spend <= 0) return null;
  return roundMetric(((revenue - spend) / spend) * 100);
}

export function calculateCommercialRevenueLeakage(input: CommercialRevenueLeakageInput): CommercialRevenueLeakageResult {
  const missingInputs: string[] = [];
  const averageTreatmentValue = readNonNegative(input.averageTreatmentValue, "averageTreatmentValue", missingInputs);
  const missedCalls = readNonNegative(input.missedCalls, "missedCalls", missingInputs);
  const slowResponseLeads = readNonNegative(input.slowResponseLeads, "slowResponseLeads", missingInputs);
  const noShows = readNonNegative(input.noShows, "noShows", missingInputs);
  const slowResponseDropoutRate = readRate(input.slowResponseDropoutRate, "slowResponseDropoutRate", missingInputs);

  const missedCallsLeakage = averageTreatmentValue === null || missedCalls === null ? null : roundMetric(missedCalls * averageTreatmentValue);
  const slowResponseLeakage =
    averageTreatmentValue === null || slowResponseLeads === null || slowResponseDropoutRate === null
      ? null
      : roundMetric(slowResponseLeads * averageTreatmentValue * slowResponseDropoutRate);
  const noShowLeakage = averageTreatmentValue === null || noShows === null ? null : roundMetric(noShows * averageTreatmentValue);
  const availableComponents = [missedCallsLeakage, slowResponseLeakage, noShowLeakage].filter(isFiniteNumber);

  return {
    total: availableComponents.length > 0 ? roundMetric(availableComponents.reduce((sum, value) => sum + value, 0)) : null,
    unit: "currency",
    components: {
      missedCalls: missedCallsLeakage,
      slowResponse: slowResponseLeakage,
      noShows: noShowLeakage,
    },
    missingInputs,
  };
}

function metric(
  key: string,
  label: string,
  unit: UnifiedMetricUnit,
  category: UnifiedMetricCategory,
  sourceRequirement: UnifiedMetricDefinition["sourceRequirement"],
  dimensions: UnifiedDimensionKey[],
): UnifiedMetricDefinition {
  return { key, label, unit, category, sourceRequirement, nullableWhenMissing: true, dimensions };
}

function normalizeMetricKey(key: string) {
  return key.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function readNonNegative(value: number | null | undefined, field: string, missingInputs: string[]) {
  if (!isFiniteNumber(value) || value < 0) {
    missingInputs.push(field);
    return null;
  }
  return value;
}

function readRate(value: number | null | undefined, field: string, missingInputs: string[]) {
  if (!isFiniteNumber(value) || value < 0 || value > 1) {
    missingInputs.push(field);
    return null;
  }
  return value;
}

function roundMetric(value: number) {
  return Math.round(value * 100) / 100;
}
