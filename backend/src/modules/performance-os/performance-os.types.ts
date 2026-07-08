export interface PerformanceOsListQuery {
  contactId?: string;
  status?: string;
  severity?: string;
  type?: string;
}

export interface PerformanceAlertResponse {
  id: string;
  type: string;
  severity: string;
  title: string;
  summary: string | null;
  sourceType: string;
  sourceId: string | null;
  sourceContactId: string | null;
  insightId: string | null;
  status: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface AttributionChainResponse {
  contact: Record<string, unknown>;
  source: Record<string, unknown>;
  campaigns: Array<Record<string, unknown>>;
  touchpoints: {
    calls: Array<Record<string, unknown>>;
    messages: Array<Record<string, unknown>>;
    forms: Array<Record<string, unknown>>;
  };
  bookings: Array<Record<string, unknown>>;
  consultations: Array<Record<string, unknown>>;
  treatments: Array<Record<string, unknown>>;
  revenue: {
    total: number;
    currency: string;
    records: Array<Record<string, unknown>>;
  };
  insights: Array<Record<string, unknown>>;
  alerts: PerformanceAlertResponse[];
  unknowns: string[];
}
