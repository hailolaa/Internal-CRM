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
