"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Loader2, Mail, RefreshCw } from "lucide-react";
import ClinicGrowerLogo from "@/components/brand/ClinicGrowerLogo";
import { api, ApiClientError, clearStoredAuthSession } from "@/lib/api-client";
import { ROUTES } from "@/lib/constants";

type VerificationState = "idle" | "verifying" | "verified" | "error";

function getVerificationParams() {
  if (typeof window === "undefined") return { email: "", token: "" };

  const params = new URLSearchParams(window.location.search);
  return {
    email: params.get("email") || "",
    token: params.get("token") || "",
  };
}

export default function VerifyEmailPage() {
  const router = useRouter();
  const [email, setEmail] = useState(() => getVerificationParams().email);
  const [token] = useState(() => getVerificationParams().token);
  const [status, setStatus] = useState<VerificationState>("idle");
  const [message, setMessage] = useState(
    "Check your inbox and click the verification link before opening the dashboard.",
  );
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  useEffect(() => {
    if (!email || !token) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setStatus("verifying");
      setMessage("Verifying your email address...");

      api.auth
        .verifyEmail(email, token)
        .then(() => {
          if (cancelled) return;
          clearStoredAuthSession();
          setStatus("verified");
          setMessage("Email verified. Please sign in again to open your dashboard.");
        })
        .catch((error) => {
          if (cancelled) return;
          setStatus("error");
          setMessage(
            error instanceof ApiClientError
              ? error.message
              : "This verification link could not be used. Request a fresh link below.",
          );
        });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [email, token]);

  const canResend = useMemo(
    () => Boolean(email.trim()) && !isResending && status !== "verifying",
    [email, isResending, status],
  );

  const handleResend = async () => {
    if (!email.trim()) {
      setResendMessage("Enter the email address you used to sign up.");
      return;
    }

    setIsResending(true);
    setResendMessage("");

    try {
      await api.auth.resendVerificationEmail(email.trim());
      setResendMessage("Verification email sent. Check your inbox.");
    } catch (error) {
      setResendMessage(
        error instanceof ApiClientError
          ? error.message
          : "Could not send a new verification email. Please try again.",
      );
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-5"
      style={{ backgroundColor: "#FAF9F6" }}
    >
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href={ROUTES.HOME} className="mb-7 inline-flex justify-center">
            <ClinicGrowerLogo variant="full" />
          </Link>
          <h1 className="mb-2 text-2xl font-semibold tracking-tight text-[#111111]">
            Verify your email
          </h1>
          <p className="text-sm leading-relaxed text-[#6B7280]">
            Dashboard access unlocks once your email address is confirmed.
          </p>
        </div>

        <div className="rounded-[28px] border border-black/5 bg-white p-8 shadow-[0_4px_24px_rgba(0,0,0,0.05)]">
          <div className="mb-6 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#EFEAFB] text-[#6E6AE8]">
              {status === "verified" ? (
                <CheckCircle2 className="h-7 w-7" />
              ) : status === "verifying" ? (
                <Loader2 className="h-7 w-7 animate-spin" />
              ) : (
                <Mail className="h-7 w-7" />
              )}
            </div>
          </div>

          <p className="mb-5 text-center text-sm leading-6 text-[#4B5563]">
            {message}
          </p>

          {status === "verified" ? (
            <button
              type="button"
              onClick={() => router.push(ROUTES.LOGIN)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#6E6AE8] py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Sign in <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm text-[#6F6875]">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@clinic.com"
                  className="w-full rounded-xl border border-black/10 bg-[#FAFAFA] px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#6E6AE8] focus:bg-white focus:shadow-[0_0_0_3px_rgba(110,106,232,0.10)]"
                />
              </div>

              <button
                type="button"
                disabled={!canResend}
                onClick={handleResend}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#6E6AE8] py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {isResending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Resend verification email
              </button>

              {resendMessage && (
                <p className="rounded-xl border border-[#6E6AE8]/15 bg-[#EFEAFB] px-3 py-2 text-sm text-[#4B3F9F]">
                  {resendMessage}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
