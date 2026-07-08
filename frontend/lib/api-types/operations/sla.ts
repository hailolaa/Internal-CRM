export type SlaLeadStatus = "safe" | "warning" | "breached";

export interface SlaSummaryRecord {
  targetMinutes: number;
  activeLeadCount: number;
  atRiskLeadCount: number;
  breachedLeadCount: number;
  averageResponseMinutes: number;
  complianceRate: number;
  breachCount7d: number;
  averageBreachMinutes: number;
  estimatedRevenueRisk: number;
  riskLabel: "estimated";
}

export interface SlaLeadRecord {
  contactId: string;
  name: string;
  source: string;
  treatment: string;
  arrivedAt: string;
  elapsedMinutes: number;
  slaTargetMinutes: number;
  status: SlaLeadStatus;
  assignedTo: string;
  estimatedValue: number;
}

export interface SlaBreachRecord {
  id: string;
  contactId: string;
  leadName: string;
  source: string;
  treatment: string;
  slaTargetMinutes: number;
  actualMinutes: number;
  breachMinutes: number;
  assignedTo: string;
  breachedAt: string;
  reason: string;
  estimatedRevenueRisk: number;
  riskLabel: "estimated";
}

export interface ResponseTimeMetricsRecord {
  averageResponseMinutes: number;
  respondedLeads: number;
  complianceRate: number;
  bySource: Array<{
    source: string;
    respondedLeads: number;
    averageResponseMinutes: number;
    complianceRate: number;
  }>;
}

export interface StaffResponseMetricRecord {
  userId: string | null;
  userName: string;
  respondedLeads: number;
  averageResponseMinutes: number;
  complianceRate: number;
}

export interface ContactMarkContactedResult {
  contactId: string;
  firstResponseAt: string | null;
  responseMinutes: number;
}
