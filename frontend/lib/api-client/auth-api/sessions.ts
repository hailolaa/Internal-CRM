import type {
  BackendAuthResponse,
  BackendClinicMembership,
  BackendCurrentSessionResponse,
  BackendSecurityEvent,
  BackendSession,
} from "@/lib/api-types";
import type { AuthApiDeps } from "./types";

export function createAuthSessionsApi({
  apiRequest,
  saveAuthSession,
  toStoredSession,
}: AuthApiDeps) {
  return {
    async me(token: string) {
      const response = await apiRequest<BackendCurrentSessionResponse>(
        "/api/auth/me",
        { token },
      );
      return response.data!;
    },
    async getClinics(token: string) {
      const response = await apiRequest<BackendClinicMembership[]>(
        "/api/auth/clinics",
        { token },
      );
      return response.data!;
    },
    async switchClinic(
      token: string,
      payload: {
        clinicId: string;
        refreshToken?: string;
        rememberMe?: boolean;
      },
    ) {
      const response = await apiRequest<BackendAuthResponse>(
        "/api/auth/switch-clinic",
        {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        },
      );
      const session = toStoredSession(response.data!, payload.rememberMe);
      saveAuthSession(session);
      return session;
    },
    async logout(token: string, refreshToken?: string) {
      return apiRequest<never>("/api/auth/logout", {
        method: "POST",
        token,
        body: JSON.stringify({ refreshToken }),
      });
    },
    async logoutAll(token: string, refreshToken?: string) {
      return apiRequest<never>("/api/auth/logout-all", {
        method: "POST",
        token,
        body: JSON.stringify({ refreshToken }),
      });
    },
    async revokeSession(
      token: string,
      sessionId: string,
      refreshToken?: string,
    ) {
      return apiRequest<never>(`/api/auth/sessions/${sessionId}`, {
        method: "DELETE",
        token,
        body: JSON.stringify({ refreshToken }),
      });
    },
    async getSessions(token: string, refreshToken?: string) {
      const params = refreshToken
        ? `?${new URLSearchParams({ refreshToken }).toString()}`
        : "";
      const response = await apiRequest<BackendSession[]>(
        `/api/auth/sessions${params}`,
        { token },
      );
      return response.data!;
    },
    async getSecurityEvents(token: string) {
      const response = await apiRequest<BackendSecurityEvent[]>(
        "/api/auth/security-events",
        { token },
      );
      return response.data!;
    },
  };
}
