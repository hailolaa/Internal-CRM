"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Lock, LockKeyhole, Mail } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { ROUTES } from "@/lib/constants";
import { getPostVerificationRoute } from "@/lib/signup-progress";
import ClinicGrowerLogo from "@/components/brand/ClinicGrowerLogo";

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const session = await api.auth.login(email, password, rememberMe);
      if (!session.user.emailVerifiedAt) {
        router.push(
          `${ROUTES.VERIFY_EMAIL}?email=${encodeURIComponent(session.user.email)}`,
        );
        return;
      }

      router.push(await getPostVerificationRoute(session.token));
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Unable to sign in. Check your details and try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuth = (provider: "google") => {
    window.location.assign(api.auth.getOAuthUrl(provider, "login", rememberMe));
  };

  return (
    <main className="min-h-screen bg-[#F7F4EE] px-4 py-4 text-[#151F21] sm:px-6 lg:h-screen lg:overflow-hidden">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-6xl overflow-hidden rounded-lg border border-[rgba(21,31,33,0.08)] bg-white shadow-[0_24px_70px_rgba(21,31,33,0.10)] lg:h-full lg:min-h-0 lg:grid-cols-[minmax(0,0.9fr)_minmax(400px,0.62fr)]">
        <section
          className="relative hidden p-8 lg:flex lg:flex-col lg:justify-between"
          style={{ backgroundColor: "#071D20", color: "#FFFFFF" }}
        >
          <Link
            href={ROUTES.HOME}
            className="inline-flex w-fit rounded-lg bg-white px-3 py-2"
          >
            <ClinicGrowerLogo variant="full" />
          </Link>

          <div className="max-w-lg">
            <p
              className="text-xs font-bold uppercase tracking-[0.2em]"
              style={{ color: "#9DD8D5" }}
            >
              ClinicGrower Mission Control
            </p>
            <h1
              className="mt-4 text-3xl font-semibold leading-tight tracking-tight xl:text-4xl"
              style={{ color: "#FFFFFF" }}
            >
              Internal CRM access for sales, proposals and delivery work.
            </h1>
            <p
              className="mt-4 max-w-md text-sm leading-6"
              style={{ color: "#D6E4E2" }}
            >
              Sign in to manage prospects, client accounts, communications,
              onboarding, tasks and the operational work behind ClinicGrower.
            </p>
          </div>

          <p
            className="max-w-md text-sm leading-6"
            style={{ color: "#D6E4E2" }}
          >
            Built for internal team use only. Client-facing clinic tools remain
            separate from this workspace.
          </p>
        </section>

        <section className="flex items-center justify-center px-5 py-7 sm:px-8 lg:px-10">
          <div className="w-full max-w-[430px]">
            <div className="mb-8 flex justify-center lg:hidden">
              <Link href={ROUTES.HOME} className="inline-flex">
                <ClinicGrowerLogo variant="full" />
              </Link>
            </div>

            <div className="mb-5 text-center lg:text-left">
              <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-[#E7F4F2] text-[#0E5859] lg:mx-0">
                <LockKeyhole className="h-5 w-5" />
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9A5524]">
                Team sign in
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#151F21]">
                Welcome back
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#5E6E70]">
                Use your authorised ClinicGrower team account to open Mission
                Control.
              </p>
            </div>

            {error && (
              <p className="mb-4 rounded-lg border border-[rgba(154,85,36,0.18)] bg-[rgba(154,85,36,0.08)] px-3 py-2 text-sm text-[#9A5524]">
                {error}
              </p>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-sm font-semibold text-[#151F21]"
                >
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7B8B8D]" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="name@clinicgrower.co.uk"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="min-h-12 w-full rounded-lg border border-[rgba(21,31,33,0.12)] bg-[#F8FAF8] py-3 pl-11 pr-4 text-sm text-[#151F21] outline-none transition-colors placeholder:text-[#96A1A2] focus:border-[#4CA9A5] focus:bg-white focus:ring-4 focus:ring-[#4CA9A5]/10"
                  />
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <label
                    htmlFor="password"
                    className="block text-sm font-semibold text-[#151F21]"
                  >
                    Password
                  </label>
                  <Link
                    href={ROUTES.FORGOT_PASSWORD}
                    className="text-xs font-semibold text-[#0E7371] transition-colors hover:text-[#09504F]"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7B8B8D]" />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="min-h-12 w-full rounded-lg border border-[rgba(21,31,33,0.12)] bg-[#F8FAF8] py-3 pl-11 pr-11 text-sm text-[#151F21] outline-none transition-colors placeholder:text-[#96A1A2] focus:border-[#4CA9A5] focus:bg-white focus:ring-4 focus:ring-[#4CA9A5]/10"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#7B8B8D] transition-colors hover:text-[#151F21]"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  id="remember"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-[rgba(21,31,33,0.18)] accent-[#0E7371]"
                />
                <label htmlFor="remember" className="select-none text-sm text-[#5E6E70]">
                  Remember me for 30 days
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#151F21] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#253639] disabled:cursor-not-allowed disabled:opacity-55"
              >
                {isLoading ? (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <>
                    Sign in
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-[rgba(21,31,33,0.08)]" />
              <span className="text-xs font-medium text-[#7B8B8D]">
                or use company access
              </span>
              <div className="h-px flex-1 bg-[rgba(21,31,33,0.08)]" />
            </div>

            <button
              type="button"
              onClick={() => handleOAuth("google")}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[rgba(21,31,33,0.12)] bg-white px-4 text-sm font-semibold text-[#151F21] transition-colors hover:bg-[#F8FAF8]"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </button>

            <p className="mt-4 text-center text-xs leading-5 text-[#7B8B8D]">
              Access is limited to authorised ClinicGrower team accounts.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
