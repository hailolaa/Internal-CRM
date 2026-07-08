import type { BackendAuthResponse, StoredAuthSession } from "@/lib/api-types";
import type { ApiRequest } from "./core";
import { createAuthApi } from "./auth-api";
import { createBillingSecurityApi } from "./billing-security-api";
import { createHealthAuditApi } from "./health-audit-api";
import { createProfileSettingsApi } from "./profile-settings-api";
import { createTeamApi } from "./team-api";

type AccountApiDeps = {
  apiRequest: ApiRequest;
  toStoredSession: (
    auth: BackendAuthResponse,
    rememberMe?: boolean,
  ) => StoredAuthSession;
  saveAuthSession: (session: StoredAuthSession) => void;
};

export function createAccountApi({
  apiRequest,
  saveAuthSession,
  toStoredSession,
}: AccountApiDeps) {
  const authSessionDeps = {
    apiRequest,
    saveAuthSession,
    toStoredSession,
  };

  return {
    ...createHealthAuditApi(apiRequest),
    ...createAuthApi(authSessionDeps),
    ...createProfileSettingsApi(apiRequest),
    ...createTeamApi(authSessionDeps),
    ...createBillingSecurityApi(apiRequest),
  };
}
