import type {
  DepositPaymentSessionResponse,
  DepositRecordResponse,
  TreatmentPlanRecord,
} from "@/lib/api-types";
import type { ApiRequest } from "./core";

export function createRevenueApi(apiRequest: ApiRequest) {
  return {
    deposits: {
      async list(token: string) {
        const response = await apiRequest<DepositRecordResponse[]>(
          "/api/deposits",
          { token },
        );
        return response.data!;
      },
      async update(
        token: string,
        depositId: string,
        payload: Partial<{
          reminderSent: boolean;
          depositRequested: boolean;
          status: "requested" | "paid" | "failed" | "unpaid" | "waived" | "refunded";
        }>,
      ) {
        return apiRequest<never>(`/api/deposits/${depositId}`, {
          method: "PATCH",
          token,
          body: JSON.stringify(payload),
        });
      },
      async createSession(
        token: string,
        payload: {
          contactName?: string | null;
          contactId?: string | null;
          appointmentId?: string | null;
          consultId?: string | null;
          treatmentId?: string | null;
          practitionerId?: string | null;
          treatment: string;
          depositAmount: number;
          successUrl?: string;
          cancelUrl?: string;
        },
      ) {
        const response = await apiRequest<DepositPaymentSessionResponse>(
          "/api/deposits/session",
          {
            method: "POST",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
    },
    treatmentPlans: {
      async list(token: string) {
        const response = await apiRequest<TreatmentPlanRecord[]>(
          "/api/treatment-plans",
          { token },
        );
        return response.data!;
      },
      async create(
        token: string,
        payload: {
          contact: string;
          avatar?: string;
          treatment: string;
          items?: string[];
          totalValue?: number;
          paid?: number;
          outstanding?: number;
          status?: string;
          sessions?: number;
          sessionsCompleted?: number;
          nextSession?: string | null;
          practitioner?: string;
        },
      ) {
        const response = await apiRequest<{ id: string }>(
          "/api/treatment-plans",
          {
            method: "POST",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async update(
        token: string,
        planId: string,
        payload: Partial<{
          contact: string;
          avatar: string;
          treatment: string;
          items: string[];
          totalValue: number;
          paid: number;
          outstanding: number;
          status: string;
          sessions: number;
          sessionsCompleted: number;
          nextSession: string | null;
          practitioner: string;
        }>,
      ) {
        return apiRequest<never>(`/api/treatment-plans/${planId}`, {
          method: "PATCH",
          token,
          body: JSON.stringify(payload),
        });
      },
      async remove(token: string, planId: string) {
        return apiRequest<never>(`/api/treatment-plans/${planId}`, {
          method: "DELETE",
          token,
        });
      },
    },
  };
}
