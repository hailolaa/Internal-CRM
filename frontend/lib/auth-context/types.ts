import type { AuthUser, UserRole } from "@/lib/types";
import type { Session } from "@/lib/auth-session";

export interface AuthContextValue {
  user: AuthUser | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (
    email: string,
    password: string,
    rememberMe?: boolean,
  ) => Promise<boolean>;
  verify2fa: (
    email: string,
    code: string,
    rememberMe?: boolean,
  ) => Promise<boolean>;
  switchClinic: (clinicId: string) => Promise<boolean>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: UserRole) => boolean;
}

export interface AuthState {
  user: AuthUser | null;
  session: Session | null;
  isLoading: boolean;
}
