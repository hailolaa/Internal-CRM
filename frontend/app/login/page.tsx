"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, ArrowRight, Eye, EyeOff } from "lucide-react";
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

  const handleOAuth = (provider: "google" | "facebook" | "apple") => {
    window.location.assign(api.auth.getOAuthUrl(provider, "login", rememberMe));
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-5"
      style={{ backgroundColor: "#FAF9F6" }}
    >
      <div className="w-full max-w-md">
        {/* Logo + heading */}
        <div className="text-center mb-9">
          <Link href={ROUTES.HOME} className="inline-flex justify-center mb-7">
            <ClinicGrowerLogo variant="full" />
          </Link>
          <h1
            className="text-2xl font-semibold tracking-tight mb-2"
            style={{ color: "#111111" }}
          >
            Welcome back
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: "#6B7280" }}>
            Sign in to your ClinicGrower growth operating system.
          </p>
        </div>

        {/* Card */}
        <div
          className="p-8"
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: "28px",
            border: "1px solid rgba(0,0,0,0.06)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.05)",
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ color: "#111111" }}
              >
                Email address
              </label>
              <div className="relative">
                <Mail
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
                  style={{ color: "#9CA3AF" }}
                />
                <input
                  type="email"
                  placeholder="you@clinic.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 text-sm outline-none transition-all"
                  style={{
                    backgroundColor: "#FAFAFA",
                    border: "1px solid rgba(0,0,0,0.08)",
                    borderRadius: "12px",
                    color: "#111111",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#6E6AE8";
                    e.currentTarget.style.boxShadow =
                      "0 0 0 3px rgba(110,106,232,0.10)";
                    e.currentTarget.style.backgroundColor = "#FFFFFF";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "rgba(0,0,0,0.08)";
                    e.currentTarget.style.boxShadow = "none";
                    e.currentTarget.style.backgroundColor = "#FAFAFA";
                  }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  className="block text-sm font-medium"
                  style={{ color: "#111111" }}
                >
                  Password
                </label>
                <Link
                  href={ROUTES.FORGOT_PASSWORD}
                  className="text-xs font-medium transition-opacity hover:opacity-70"
                  style={{ color: "#6E6AE8" }}
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
                  style={{ color: "#9CA3AF" }}
                />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-11 py-3 text-sm outline-none transition-all"
                  style={{
                    backgroundColor: "#FAFAFA",
                    border: "1px solid rgba(0,0,0,0.08)",
                    borderRadius: "12px",
                    color: "#111111",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#6E6AE8";
                    e.currentTarget.style.boxShadow =
                      "0 0 0 3px rgba(110,106,232,0.10)";
                    e.currentTarget.style.backgroundColor = "#FFFFFF";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "rgba(0,0,0,0.08)";
                    e.currentTarget.style.boxShadow = "none";
                    e.currentTarget.style.backgroundColor = "#FAFAFA";
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-60"
                  style={{ color: "#9CA3AF" }}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                id="remember"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded accent-[#6E6AE8]"
              />
              <label
                htmlFor="remember"
                className="text-sm select-none"
                style={{ color: "#6B7280" }}
              >
                Remember me for 30 days
              </label>
            </div>

            {error && (
              <p
                className="rounded-xl px-3 py-2 text-sm"
                style={{
                  color: "#9A5524",
                  backgroundColor: "rgba(154,85,36,0.08)",
                  border: "1px solid rgba(154,85,36,0.16)",
                }}
              >
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full font-semibold py-3 flex items-center justify-center gap-2 transition-all disabled:opacity-50 text-white text-sm"
              style={{
                backgroundColor: "#6E6AE8",
                borderRadius: "14px",
                boxShadow: "0 4px 16px rgba(110,106,232,0.22)",
              }}
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Sign in <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-7">
            <div className="absolute inset-0 flex items-center">
              <div
                className="w-full"
                style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}
              />
            </div>
            <div className="relative flex justify-center text-xs">
              <span
                className="px-3 text-[#9CA3AF]"
                style={{ backgroundColor: "#FFFFFF" }}
              >
                or continue with
              </span>
            </div>
          </div>

          {/* Social */}
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => handleOAuth("google")}
              className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-all hover:opacity-80"
              style={{
                backgroundColor: "#FAFAFA",
                border: "1px solid rgba(0,0,0,0.08)",
                borderRadius: "12px",
                color: "#111111",
              }}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
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
              Google
            </button>
            <button
              type="button"
              onClick={() => handleOAuth("facebook")}
              className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-all hover:opacity-80"
              style={{
                backgroundColor: "#FAFAFA",
                border: "1px solid rgba(0,0,0,0.08)",
                borderRadius: "12px",
                color: "#111111",
              }}
            >
              <span className="flex h-4 w-4 items-center justify-center rounded bg-[#1877F2] text-[11px] font-bold text-white">
                f
              </span>
              Facebook
            </button>
            <button
              type="button"
              onClick={() => handleOAuth("apple")}
              className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-all hover:opacity-80"
              style={{
                backgroundColor: "#FAFAFA",
                border: "1px solid rgba(0,0,0,0.08)",
                borderRadius: "12px",
                color: "#111111",
              }}
            >
              <svg className="w-4 h-4" fill="#111111" viewBox="0 0 24 24">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
              Apple
            </button>
          </div>
        </div>

        <p className="text-center text-sm mt-6" style={{ color: "#6B7280" }}>
          Don&apos;t have an account?{" "}
          <Link
            href={ROUTES.SIGNUP}
            className="font-medium transition-opacity hover:opacity-70"
            style={{ color: "#6E6AE8" }}
          >
            Start free trial
          </Link>
        </p>
      </div>
    </div>
  );
}
