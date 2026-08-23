export type MrrMovementCategory = "new" | "expansion" | "contraction" | "churn" | "stable";

export interface FinancePeriodRange {
  clinicId: string;
  fromMonth: string;
  toMonth: string;
}

export interface ClientMonthlyCostInput {
  clinicId: string;
  clientAccountProfileId: string;
  periodMonth: string;
  costCents: number;
  currency?: string;
  source?: string | null;
  notes?: string | null;
  createdBy?: string | null;
}

export interface ClientRevenuePeriod {
  clientAccountProfileId: string;
  periodMonth: string;
  currency: string;
  mrrCents: number;
  recognizedRevenueCents: number;
  costCents: number;
  marginCents: number;
  marginPercent: number | null;
}

export interface ClientMrrMovement {
  clientAccountProfileId: string;
  periodMonth: string;
  currency: string;
  previousMrrCents: number;
  currentMrrCents: number;
  movementCents: number;
  category: MrrMovementCategory;
}

export interface FinanceRevenueView {
  periods: ClientRevenuePeriod[];
  movements: ClientMrrMovement[];
  totals: {
    currency: string;
    mrrCents: number;
    recognizedRevenueCents: number;
    costCents: number;
    marginCents: number;
    marginPercent: number | null;
  };
}

export interface RevenueRiskPrediction {
  clientAccountProfileId: string;
  periodMonth: string;
  currency: string;
  riskScore: number;
  riskLevel: "low" | "medium" | "high";
  predictedRevenueAtRiskCents: number;
  currentMrrCents: number;
  marginPercent: number | null;
  explanations: string[];
  recommendedActions: string[];
}

export interface RevenueRiskBacktest {
  fromMonth: string;
  toMonth: string;
  validationRows: number;
  truePositive: number;
  trueNegative: number;
  falsePositive: number;
  falseNegative: number;
  accuracy: number | null;
  threshold: number;
  meetsThreshold: boolean;
  status: "validated" | "insufficient_history";
}

export interface RevenueRiskModelReport {
  model: {
    name: "revenue_risk_v1";
    type: "deterministic_weighted_rules";
    version: 1;
    trainedFrom: "client_revenue_periods_and_account_risk_signals";
    explainability: "per_prediction_weighted_reasons";
  };
  fromMonth: string;
  toMonth: string;
  predictions: RevenueRiskPrediction[];
  backtest: RevenueRiskBacktest;
}
