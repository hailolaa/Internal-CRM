export type OnboardingStatus = "not_started" | "in_progress" | "completed" | "paused";
export type HealthStatus = "healthy" | "attention_needed" | "at_risk" | "critical";
export type ChurnRisk = "low" | "medium" | "high" | "critical";
export type ContractStatus = "active" | "trial" | "pending" | "paused" | "cancelled" | "expired";
export type ClientStatus = "prospect" | "onboarding" | "active" | "paused" | "at_risk" | "churned" | "inactive";
export type ClientServiceType = "ppc" | "seo" | "gbp" | "website" | "landing_pages" | "cro" | "strategy" | "other";
export type ClientServiceStatus = "onboarding" | "active" | "paused" | "ended" | "archived";
export type MonthlyActionPlanStatus = "draft" | "active" | "completed" | "archived";

export interface UpdateClientAccountProfileDTO {
  accountManagerId?: string | null;
  activeServices?: string[];
  onboardingStatus?: OnboardingStatus;
  healthStatus?: HealthStatus;
  clientStatus?: ClientStatus;
  currentPackage?: string | null;
  churnRisk?: ChurnRisk;
  renewalDate?: string | null;
  contractStatus?: ContractStatus;
  keyNotes?: string | null;
}

export interface CreateClientAccountDTO extends UpdateClientAccountProfileDTO {
  name: string;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
}

export interface CreateClientAccountFromContactDTO
  extends Omit<CreateClientAccountDTO, "name" | "email" | "phone" | "address" | "city" | "state" | "postalCode" | "country"> {
  contactId: string;
  accountName?: string | null;
}

export interface ClientAccountProfileResponse {
  id: string | null;
  clinicId: string;
  clinicName: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  accountType: string | null;
  accountManager: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  } | null;
  activeServices: string[];
  onboardingStatus: OnboardingStatus;
  healthStatus: HealthStatus;
  clientStatus: ClientStatus;
  currentPackage: string | null;
  churnRisk: ChurnRisk;
  renewalDate: string | null;
  contractStatus: ContractStatus;
  keyNotes: string | null;
  updatedAt: string | null;
}

export interface ClientAccountSummaryResponse extends ClientAccountProfileResponse {
  activeServiceCount: number;
  renewalRiskCount: number;
  pendingTaskCount: number;
  overdueTaskCount: number;
  qaTaskCount: number;
  missedTaskCount: number;
  escalatedTaskCount: number;
  lastStrategyLogAt: string | null;
  actionPlanId: string | null;
  actionPlanMonth: string | null;
  actionPlanStatus: MonthlyActionPlanStatus | null;
  actionPlanTotalItems: number;
  actionPlanCompletedItems: number;
  actionPlanOpenItems: number;
  actionPlanHighPriorityOpenItems: number;
  actionPlanProgressPercent: number;
  actionPlanLastUpdatedAt: string | null;
}

export interface ClientAccountAuditContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface CreateClientAccountServiceDTO {
  serviceType: ClientServiceType;
  name: string;
  status?: ClientServiceStatus;
  startDate?: string | null;
  renewalDate?: string | null;
  endDate?: string | null;
  ownerId?: string | null;
  recurringValue?: number | string | null;
  currency?: string;
  contractStatus?: ContractStatus;
  notes?: string | null;
}

export interface UpdateClientAccountServiceDTO {
  serviceType?: ClientServiceType;
  name?: string;
  status?: Exclude<ClientServiceStatus, "archived">;
  startDate?: string | null;
  renewalDate?: string | null;
  endDate?: string | null;
  ownerId?: string | null;
  recurringValue?: number | string | null;
  currency?: string;
  contractStatus?: ContractStatus;
  notes?: string | null;
}

export interface ClientAccountServiceResponse {
  id: string;
  clinicId: string;
  clientAccountProfileId: string;
  serviceType: ClientServiceType;
  name: string;
  status: ClientServiceStatus;
  startDate: string | null;
  renewalDate: string | null;
  endDate: string | null;
  owner: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  } | null;
  recurringValue: number | null;
  currency: string;
  contractStatus: ContractStatus;
  notes: string | null;
  archivedAt: string | null;
  updatedAt: string | null;
}

export interface ClientAccountServiceListQuery {
  includeArchived?: string | boolean;
  includeAllClinics?: string | boolean;
  status?: ClientServiceStatus;
  contractStatus?: ContractStatus;
  renewalFrom?: string;
  renewalTo?: string;
}

export interface ClientAccountListQuery {
  search?: string;
  healthStatus?: HealthStatus | "all";
  clientStatus?: ClientStatus | "all";
  churnRisk?: ChurnRisk | "all";
  contractStatus?: ContractStatus | "all";
}
