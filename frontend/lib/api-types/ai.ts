export interface AiGenerationProvenance {
  workflow?: string | null;
  source?: string | null;
  provider?: "openai" | "deterministic" | (string & {}) | null;
  method?: string | null;
  model?: string | null;
  responseId?: string | null;
  fallbackReason?: string | null;
  generatedAt?: string | null;
  tokens?: number | null;
  externalProcessing?: boolean | null;
  consentScope?: string | null;
  consentCaptured?: boolean | null;
  persisted?: boolean | null;
  clinicScoped?: boolean | null;
  openAiRequired?: boolean | null;
  fallbackAvailable?: boolean | null;
  mockData?: boolean | null;
  calibrated?: boolean | null;
  algorithmVersion?: string | null;
  scoreMeaning?: string | null;
  legacyAliases?: Record<string, string> | null;
  inputMode?: "live" | "manual" | (string & {}) | null;
  sources?: Record<string, string> | null;
  range?: {
    startDate?: string | null;
    endDate?: string | null;
  } | null;
}

export interface AiProjectRecord {
  id: string;
  title: string;
  type: string;
  status: "active" | "draft" | "completed" | "archived";
  runsCount: number;
  updatedAt: string;
}

export interface AiRunRecord {
  id: string;
  projectId: string | null;
  agentName: string;
  agentKey: string;
  task: string;
  input: unknown;
  output: unknown;
  status: "success" | "error" | "running";
  tokens: number;
  provider?: string | null;
  model?: string | null;
  responseId?: string | null;
  fallbackReason?: string | null;
  errorCode?: string | null;
  createdAt: string;
}

export interface AiGrowthBriefGenerateResult {
  id: string;
  agentKey: "growth_brief";
  status: "success" | "error" | "running";
  input: unknown;
  output: unknown;
  createdAt: string;
}

export interface AiShowRateAction {
  type: "send_reminder" | "request_deposit";
  label: string;
  supported: boolean;
  unavailableReason?: string;
  payload?: {
    contactId?: string | null;
    contactName?: string | null;
    appointmentId?: string | null;
    treatment: string;
    depositAmount: number;
  };
}

export interface AiShowRateRiskRow {
  appointmentId: string;
  contactId: string;
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  appointmentDate: string;
  treatment: string | null;
  valueCents: number;
  durationMinutes: number;
  priorAppointments: number;
  priorNoShows: number;
  deposit: {
    id: string;
    amount: number;
    paid: boolean;
    requested: boolean;
    status: string | null;
  } | null;
  reminderSent: boolean;
  appointmentRiskSignal?: "high" | "medium" | "low";
  priorityScore?: number;
  riskScore: number;
  riskLevel: "high" | "medium" | "low";
  reasons: string[];
  recommendedActions: AiShowRateAction[];
}

export interface AiShowRateOutput {
  provenance?: AiGenerationProvenance | null;
  summary: {
    totalAppointments: number;
    highRisk: number;
    mediumRisk: number;
    lowRisk: number;
    depositRecommended: number;
    reminderRecommended: number;
  };
  riskRows: AiShowRateRiskRow[];
  supportedActions: {
    requestDeposit: boolean;
    sendReminder: boolean;
  };
  unavailableActions: Array<{ type: string; reason: string }>;
}

export interface AiShowRateGenerateResult {
  id: string;
  agentKey: "show_rate";
  status: "success" | "error" | "running";
  input: unknown;
  output: AiShowRateOutput;
  createdAt: string;
}

export interface AiSalesAssistantFollowUp {
  channel: "sms" | "email";
  subject?: string;
  body: string;
  supported: boolean;
  action: "copy";
}

export interface AiSalesAssistantOutput {
  provenance?: AiGenerationProvenance | null;
  recommendation: string;
  summary: string;
  lead: {
    contactId: string | null;
    name: string;
    treatment: string;
    email: string | null;
    phone: string | null;
    source: string | null;
    status: string | null;
    valueCents: number;
  };
  scores: {
    followUpFrictionScore?: number;
    followUpReadinessScore?: number;
    followUpPriorityScore?: number;
    coldLeadScore: number;
    conversionProbability: number;
    urgency: "high" | "medium" | "low";
    reasons: string[];
  };
  recommendations: Array<{
    id: string;
    type: string;
    title: string;
    body: string;
    priority: "high" | "medium" | "low";
    supported: boolean;
    unavailableReason?: string;
    payload?: {
      channel?: "sms" | "email";
      body?: string;
    };
  }>;
  followUps: AiSalesAssistantFollowUp[];
  supportedActions: {
    copyFollowUp: boolean;
    sendMessage: boolean;
    createTask: boolean;
  };
  unavailableActions: Array<{ type: string; reason: string }>;
}

export interface AiSalesAssistantGenerateResult {
  id: string;
  agentKey: "sales_assistant";
  status: "success" | "error" | "running";
  input: unknown;
  output: AiSalesAssistantOutput;
  createdAt: string;
}

export interface AiCampaignAnalystOutput {
  provenance?: AiGenerationProvenance | null;
  underperforming: Array<{ name: string; issue: string; action: string }>;
  highROI: Array<{ name: string; roas: string; recommendation: string }>;
  budgetShifts: Array<{ from: string; to: string; amount: string; reason: string }>;
  projectedUplift: string;
  landingPageIssues: string[];
  metrics?: Record<string, number>;
}

export interface AiCampaignAnalystGenerateResult {
  id: string;
  agentKey: "campaign_analyst";
  status: "success" | "error" | "running";
  input: unknown;
  output: AiCampaignAnalystOutput;
  createdAt: string;
}

export interface AiLtvOptimiserOutput {
  provenance?: AiGenerationProvenance | null;
  recommendationSample?: {
    maxContacts: number;
    sampledContacts: number;
    recommendationEligibleContacts: number;
    completedActivityContacts: number;
    contactsWithFutureBooking: number;
    eligibility: string;
    ranking: string;
    recommendationsExcludeFutureBookings: boolean;
  };
  summary: {
    averageLtv: number;
    averageRevenuePerSoldTreatment?: number;
    repeatProxyRate: number;
    rebookingCoverageRate?: number;
    openDealValue: number;
    totalTreatmentRevenue: number;
    totalPatientRecommendations: number;
    underMonetisedCategories: number;
  };
  patientRecommendations: Array<{
    contactId: string;
    contactName: string;
    treatment: string;
    valueCents: number;
    completedAppointments: number;
    upcomingAppointments: number;
    recommendationType: "cross_sell" | "rebooking";
    urgency: "high" | "medium" | "low";
    reason: string;
    recommendedAction: string;
  }>;
  categoryPotential: Array<{
    treatment: string;
    category: string;
    soldTreatments: number;
    revenue: number;
    averageRevenue: number;
    potentialRevenue: number;
    priority: "high" | "medium" | "low";
    action: string;
  }>;
  underMonetised: Array<{
    treatment: string;
    category: string;
    soldTreatments: number;
    revenue: number;
    averageRevenue: number;
    potentialRevenue: number;
    priority: "high" | "medium" | "low";
    action: string;
  }>;
  rebookingTiming: {
    highUrgency: number;
    mediumUrgency: number;
    action: string;
  };
}

export interface AiLtvOptimiserGenerateResult {
  id: string;
  agentKey: "ltv_optimiser";
  status: "success" | "error" | "running";
  input: unknown;
  output: AiLtvOptimiserOutput;
  createdAt: string;
}

export interface AiCompetitorInsightsOutput {
  summary: string;
  marketPosition: {
    competitors: number;
    premiumCompetitors: number;
    strongSeo: number;
    offerCompetitors: number;
    commonTreatments: string[];
  };
  insights: Array<{
    competitorId: string;
    name: string;
    position: string;
    threatLevel: "high" | "medium" | "low";
    finding: string;
    action: string;
  }>;
  opportunities: Array<{
    title: string;
    body: string;
    priority: "high" | "medium" | "low";
  }>;
  actions: string[];
  unavailableActions: Array<{ type: string; reason: string }>;
}

export interface AiCompetitorInsightsGenerateResult {
  id: string;
  agentKey: "competitor_insights";
  status: "success" | "error" | "running";
  input: unknown;
  output: AiCompetitorInsightsOutput;
  createdAt: string;
}
