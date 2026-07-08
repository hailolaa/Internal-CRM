import { createCredentialAuthApi } from "./auth-api/credentials";
import { getOAuthUrl } from "./auth-api/oauth";
import { createAuthRecoveryApi } from "./auth-api/recovery";
import { createAuthSessionsApi } from "./auth-api/sessions";
import type { AuthApiDeps } from "./auth-api/types";

export function createAuthApi({
  apiRequest,
  saveAuthSession,
  toStoredSession,
}: AuthApiDeps) {
  return {
    auth: {
      getOAuthUrl,
      ...createCredentialAuthApi({ apiRequest, saveAuthSession, toStoredSession }),
      ...createAuthRecoveryApi({ apiRequest, saveAuthSession, toStoredSession }),
      ...createAuthSessionsApi({ apiRequest, saveAuthSession, toStoredSession }),
    },
  };
}
