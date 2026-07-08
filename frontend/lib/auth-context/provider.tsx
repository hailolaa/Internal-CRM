"use client";

import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  api,
  clearStoredAuthSession,
  getStoredAuthSession,
} from "@/lib/api-client";
import {
  createLoadedAuthState,
  emptyAuthState,
  readInitialAuthState,
} from "@/lib/auth-context/state";
import { hasUserPermission, hasUserRole } from "@/lib/auth-context/permissions";
import type { AuthState } from "@/lib/auth-context/types";
import type { UserRole } from "@/lib/types";
import { AuthContext } from "./context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>(readInitialAuthState);
  const { user, session, isLoading } = authState;

  useEffect(() => {
    const stored = getStoredAuthSession();
    if (!stored?.refreshToken) {
      return;
    }

    api.auth
      .refresh(stored.refreshToken, stored.rememberMe)
      .then((refreshed) => {
        setAuthState(
          createLoadedAuthState(
            refreshed.user,
            refreshed.token,
            refreshed.rememberMe,
          ),
        );
      })
      .catch(() => {
        clearStoredAuthSession();
        setAuthState(emptyAuthState);
      });
  }, []);

  const login = useCallback(
    async (
      email: string,
      password: string,
      rememberMe = false,
    ): Promise<boolean> => {
      setAuthState((current) => ({ ...current, isLoading: true }));
      try {
        const authSession = await api.auth.login(email, password, rememberMe);
        setAuthState(
          createLoadedAuthState(authSession.user, authSession.token, rememberMe),
        );
        return true;
      } catch {
        setAuthState((current) => ({ ...current, isLoading: false }));
        return false;
      }
    },
    [],
  );

  const verify2fa = useCallback(
    async (
      email: string,
      code: string,
      rememberMe = false,
    ): Promise<boolean> => {
      setAuthState((current) => ({ ...current, isLoading: true }));
      try {
        const authSession = await api.auth.verify2fa(email, code, rememberMe);
        setAuthState(
          createLoadedAuthState(authSession.user, authSession.token, rememberMe),
        );
        return true;
      } catch {
        setAuthState((current) => ({ ...current, isLoading: false }));
        return false;
      }
    },
    [],
  );

  const switchClinic = useCallback(async (clinicId: string): Promise<boolean> => {
    const stored = getStoredAuthSession();
    if (!stored?.token) return false;

    setAuthState((current) => ({ ...current, isLoading: true }));
    try {
      const authSession = await api.auth.switchClinic(stored.token, {
        clinicId,
        refreshToken: stored.refreshToken,
        rememberMe: stored.rememberMe,
      });
      setAuthState(
        createLoadedAuthState(
          authSession.user,
          authSession.token,
          authSession.rememberMe,
        ),
      );
      return true;
    } catch {
      setAuthState((current) => ({ ...current, isLoading: false }));
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    const stored = getStoredAuthSession();
    if (stored?.token) {
      api.auth.logout(stored.token, stored.refreshToken).catch(() => undefined);
    }
    clearStoredAuthSession();
    setAuthState(emptyAuthState);
  }, []);

  const hasPermission = useCallback(
    (permission: string) => hasUserPermission(user, permission),
    [user],
  );

  const hasRole = useCallback(
    (role: UserRole) => hasUserRole(user, role),
    [user],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isAuthenticated: !!user,
        isLoading,
        login,
        verify2fa,
        switchClinic,
        logout,
        hasPermission,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
