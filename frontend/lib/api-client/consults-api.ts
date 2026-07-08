import type {
  ConsultSummaryRecord,
  ManualConsultRecord,
  PractitionerConversionRecord,
} from "@/lib/api-types";
import type { ApiRequest } from "./core";

export interface ConsultPayload {
  contactId?: string | null;
  appointmentId?: string | null;
  patientName?: string | null;
  treatment: string;
  practitioner?: string | null;
  practitionerId?: string | null;
  outcome: string;
  revenue?: number | null;
  date?: string | null;
  notes?: string | null;
  depositStatus?: string | null;
  lostReason?: string | null;
}

export function createConsultsApi(apiRequest: ApiRequest) {
  return {
    consults: {
      async list(token: string) {
        const response = await apiRequest<ManualConsultRecord[]>("/api/consults", {
          token,
        });
        return response.data!;
      },
      async create(token: string, payload: ConsultPayload) {
        const response = await apiRequest<{ id: string }>("/api/consults", {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        });
        return response.data!;
      },
      async update(token: string, consultId: string, payload: Partial<ConsultPayload>) {
        const response = await apiRequest<ManualConsultRecord>(
          `/api/consults/${consultId}`,
          {
            method: "PATCH",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async outcome(token: string, consultId: string, payload: Partial<ConsultPayload>) {
        const response = await apiRequest<ManualConsultRecord>(
          `/api/consults/${consultId}/outcome`,
          {
            method: "PATCH",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async summary(token: string) {
        const response = await apiRequest<ConsultSummaryRecord>(
          "/api/metrics/consults/summary",
          { token },
        );
        return response.data!;
      },
      async practitionerConversion(token: string) {
        const response = await apiRequest<PractitionerConversionRecord[]>(
          "/api/metrics/practitioners/conversion",
          { token },
        );
        return response.data!;
      },
    },
  };
}
