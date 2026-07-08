import type {
  BackendAuthResponse,
  RegisterClinicPayload,
  StoredAuthSession,
} from "@/lib/api-types";
import type { AuthApiDeps } from "./types";

const pendingRefreshes = new Map<string, Promise<StoredAuthSession>>();

export function createCredentialAuthApi({
  apiRequest,
  saveAuthSession,
  toStoredSession,
}: AuthApiDeps) {
  return {
    async registerClinic(payload: RegisterClinicPayload) {
      const response = await apiRequest<BackendAuthResponse>(
        "/api/auth/register/clinic",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );
      const session = toStoredSession(response.data!, true);
      saveAuthSession(session);
      return session;
    },
    async login(email: string, password: string, rememberMe = false) {
      const response = await apiRequest<BackendAuthResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password, rememberMe }),
      });
      const session = toStoredSession(response.data!, rememberMe);
      saveAuthSession(session);
      return session;
    },
    async verify2fa(email: string, code: string, rememberMe = false) {
      const response = await apiRequest<BackendAuthResponse>(
        "/api/auth/verify-2fa",
        {
          method: "POST",
          body: JSON.stringify({ email, code, rememberMe }),
        },
      );
      const session = toStoredSession(response.data!, rememberMe);
      saveAuthSession(session);
      return session;
    },
    async refresh(refreshToken: string, rememberMe = false) {
      const pendingRefresh = pendingRefreshes.get(refreshToken);
      if (pendingRefresh) return pendingRefresh;

      const refreshRequest = (async () => {
        const response = await apiRequest<BackendAuthResponse>(
          "/api/auth/refresh",
          {
            method: "POST",
            body: JSON.stringify({ refreshToken }),
          },
        );
        const session = toStoredSession(response.data!, rememberMe);
        saveAuthSession(session);
        return session;
      })();

      pendingRefreshes.set(refreshToken, refreshRequest);

      try {
        return await refreshRequest;
      } finally {
        pendingRefreshes.delete(refreshToken);
      }
    },
  };
}
