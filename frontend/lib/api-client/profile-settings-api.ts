import type {
  ClinicProfile,
  SecuritySettings,
  UpdateClinicProfilePayload,
  UserPreferences,
} from "@/lib/api-types";
import type { ApiRequest } from "./core";

export function createProfileSettingsApi(apiRequest: ApiRequest) {
  return {
    profiles: {
      async getClinic(token: string) {
        const response = await apiRequest<ClinicProfile>(
          "/api/profiles/clinic",
          { token },
        );
        return response.data!;
      },
      async updateClinic(token: string, payload: UpdateClinicProfilePayload) {
        return apiRequest<never>("/api/profiles/clinic", {
          method: "PUT",
          token,
          body: JSON.stringify(payload),
        });
      },
    },
    settings: {
      async getPreferences(token: string) {
        const response = await apiRequest<UserPreferences>(
          "/api/settings/preferences",
          { token },
        );
        return response.data!;
      },
      async updatePreferences(
        token: string,
        payload: Partial<UserPreferences>,
      ) {
        return apiRequest<never>("/api/settings/preferences", {
          method: "PUT",
          token,
          body: JSON.stringify(payload),
        });
      },
      async getSecurity(token: string) {
        const response = await apiRequest<SecuritySettings>(
          "/api/settings/security",
          { token },
        );
        return response.data!;
      },
      async toggle2fa(token: string, twoFactorEnabled: boolean) {
        return apiRequest<never>("/api/settings/security/2fa", {
          method: "PUT",
          token,
          body: JSON.stringify({ twoFactorEnabled }),
        });
      },
    },
  };
}
