"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import {
  api,
  clearStoredAuthSession,
  storeAuthSession,
  type BackendAuthUser,
} from "@/lib/api-client";
import { ROUTES } from "@/lib/constants";
import ClinicGrowerLogo from "@/components/brand/ClinicGrowerLogo";

type CallbackState = "loading" | "success" | "requires_2fa" | "error";

function readOAuthParams() {
  if (typeof window === "undefined") return new URLSearchParams();

  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const search = window.location.search.startsWith("?")
    ? window.location.search.slice(1)
    : window.location.search;

  return new URLSearchParams(hash || search);
}

function parseBoolean(value: string | null) {
  return value === "true" || value === "1";
}

function decodeUser(value: string | null): BackendAuthUser | null {
  if (!value) return null;

  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "=",
    );
    return JSON.parse(window.atob(padded)) as BackendAuthUser;
  } catch {
    return null;
  }
}

function friendlyOAuthError(raw: string | null) {
  const message = (raw || "").toLowerCase();

  if (message.includes("configured")) {
    return "This OAuth provider is not configured yet. Ask an admin to check the staging provider credentials.";
  }

  if (message.includes("state")) {
    return "This OAuth session expired or could not be verified. Please start sign-in again.";
  }

  if (message.includes("email")) {
    return "The provider did not share an email address. Choose an account with a verified email or use email sign-in.";
  }

  if (
    message.includes("token exchange") ||
    message.includes("profile lookup") ||
    message.includes("provider")
  ) {
    return "The provider could not verify this sign-in. Please try again or use email sign-in.";
  }

  return "OAuth sign-in failed. Please try again or use email sign-in.";
}

export default function OAuthCallbackPage() {
  const router = useRouter();
  const [state, setState] = useState<CallbackState>("loading");
  const [message, setMessage] = useState("Completing secure sign-in...");

  useEffect(() => {
    let cancelled = false;

    async function completeOAuth() {
      const params = readOAuthParams();
      window.history.replaceState(null, "", "/oauth/callback");

      const rawError = params.get("error");
      if (rawError) {
        clearStoredAuthSession();
        setState("error");
        setMessage(friendlyOAuthError(rawError));
        return;
      }

      const token = params.get("token") || "";
      const refreshToken = params.get("refreshToken") || undefined;
      const rememberMe = parseBoolean(params.get("rememberMe"));
      const isNewUser = parseBoolean(params.get("isNewUser"));
      const requires2FA = parseBoolean(params.get("requires2FA"));
      const user = decodeUser(params.get("user"));

      if (!token || !user) {
        clearStoredAuthSession();
        setState("error");
        setMessage("OAuth sign-in returned an incomplete session. Please try again.");
        return;
      }

      if (requires2FA) {
        clearStoredAuthSession();
        setState("requires_2fa");
        setMessage(
          "Two-factor authentication is required for this account. Sign in with email and password to complete verification.",
        );
        return;
      }

      storeAuthSession(user, token, refreshToken, rememberMe, requires2FA);
      setMessage("Checking your account...");

      try {
        const currentSession = await api.auth.me(token);
        if (cancelled) return;

        storeAuthSession(
          currentSession.user,
          token,
          refreshToken,
          rememberMe,
          requires2FA,
        );
        setState("success");
        setMessage(
          isNewUser
            ? "Account created. Opening your workspace..."
            : "Signed in. Opening your workspace...",
        );

        window.setTimeout(() => {
          router.replace(ROUTES.APP);
          router.refresh();
        }, 350);
      } catch {
        clearStoredAuthSession();
        if (cancelled) return;
        setState("error");
        setMessage(
          "Your OAuth token was received, but the session could not be verified. Please try again.",
        );
      }
    }

    void completeOAuth();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const isError = state === "error" || state === "requires_2fa";
  const Icon = state === "success" ? CheckCircle2 : isError ? AlertCircle : Loader2;

  return (
    <main
      className="flex min-h-screen items-center justify-center px-5 py-10"
      style={{ backgroundColor: "#FAF9F6" }}
    >
      <section className="w-full max-w-md text-center">
        <Link href={ROUTES.HOME} className="mb-7 inline-flex justify-center">
          <ClinicGrowerLogo variant="full" />
        </Link>

        <div className="rounded-[28px] border border-black/10 bg-white p-8 shadow-[0_4px_24px_rgba(0,0,0,0.05)]">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F2F6F5]">
            <Icon
              className={`h-6 w-6 ${
                state === "loading" ? "animate-spin text-[#60b4af]" : ""
              }`}
              style={{ color: state === "loading" ? undefined : "#5e8a8d" }}
            />
          </div>

          <h1 className="text-xl font-semibold text-[#111111]">
            {isError ? "Sign-in needs attention" : "Completing OAuth sign-in"}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[#6B7280]">
            {message}
          </p>

          {isError && (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Link
                href={ROUTES.LOGIN}
                className="rounded-xl bg-[#6E6AE8] px-4 py-3 text-sm font-semibold text-white"
              >
                Back to login
              </Link>
              <Link
                href={ROUTES.SIGNUP}
                className="rounded-xl border border-black/10 px-4 py-3 text-sm font-semibold text-[#111111]"
              >
                Try signup
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
