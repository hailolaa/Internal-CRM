import type {
  BackendAuthResponse,
  StoredAuthSession,
} from "@/lib/api-types";
import type { ApiRequest } from "../core";

export type AuthApiDeps = {
  apiRequest: ApiRequest;
  toStoredSession: (
    auth: BackendAuthResponse,
    rememberMe?: boolean,
  ) => StoredAuthSession;
  saveAuthSession: (session: StoredAuthSession) => void;
};
