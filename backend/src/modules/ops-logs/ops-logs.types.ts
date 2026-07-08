export interface ManualSpendDTO {
  source: string;
  campaign: string;
  amount: number;
  period: string;
  channel?: string;
  startDate?: string | null;
  endDate?: string | null;
  attributionLabel?: string | null;
  notes?: string;
}

export type UpdateManualSpendDTO = Partial<ManualSpendDTO>;

export interface ManualConsultDTO {
  patientName: string;
  treatment: string;
  practitioner: string;
  outcome: string;
  revenue?: number;
  date?: string;
  notes?: string;
}
