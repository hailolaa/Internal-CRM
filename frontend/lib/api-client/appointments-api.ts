import type {
  AppointmentAvailabilityParams,
  AppointmentAvailabilityRecord,
  AppointmentClinicianRecord,
  AppointmentListParams,
  AppointmentPayload,
  AppointmentRecord,
  AppointmentUpdatePayload,
} from "@/lib/api-types";
import type { ApiRequest } from "./core";

function buildAppointmentQuery(params: AppointmentListParams = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function buildAvailabilityQuery(params: AppointmentAvailabilityParams) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) searchParams.set(key, String(value));
  });

  return `?${searchParams.toString()}`;
}

export function createAppointmentsApi(apiRequest: ApiRequest) {
  return {
    appointments: {
      async list(token: string, params?: AppointmentListParams) {
        const response = await apiRequest<AppointmentRecord[]>(
          `/api/appointments${buildAppointmentQuery(params)}`,
          { token },
        );
        return response.data!;
      },
      async listClinicians(token: string) {
        const response = await apiRequest<AppointmentClinicianRecord[]>(
          "/api/appointments/clinicians",
          { token },
        );
        return response.data!;
      },
      async availability(token: string, params: AppointmentAvailabilityParams) {
        const response = await apiRequest<AppointmentAvailabilityRecord>(
          `/api/appointments/availability${buildAvailabilityQuery(params)}`,
          { token },
        );
        return response.data!;
      },
      async create(token: string, payload: AppointmentPayload) {
        const response = await apiRequest<AppointmentRecord>("/api/appointments", {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        });
        return response.data!;
      },
      async update(
        token: string,
        appointmentId: string,
        payload: AppointmentUpdatePayload,
      ) {
        const response = await apiRequest<AppointmentRecord>(
          `/api/appointments/${appointmentId}`,
          {
            method: "PATCH",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
    },
  };
}
