"use client";

import Link from "next/link";
import { useState } from "react";
import { Mail, ArrowRight, ArrowLeft, CheckCircle } from "lucide-react";
import { ROUTES } from "@/lib/constants";
import ClinicGrowerLogo from "@/components/brand/ClinicGrowerLogo";
import { api } from "@/lib/api-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      setIsLoading(true);
      await api.auth.forgotPassword(email);
      setSubmitted(true);
    } catch (requestError) {
      console.error("Failed to request password reset", requestError);
      setError("Could not send the reset email. Please try again.");
    } finally {
      setIsLoading(false);
    }
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
            {submitted ? "Check your email" : "Reset your access"}
          </h1>
          <p
            className="text-sm leading-relaxed max-w-xs mx-auto"
            style={{ color: "#6B7280" }}
          >
            {submitted
              ? "If an account exists with that email, a reset link is on its way."
              : "Enter your email and we'll send instructions to get you back into your ClinicGrower growth operating system."}
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
          {submitted ? (
            <div className="text-center py-4">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
                style={{
                  backgroundColor: "rgba(110,106,232,0.07)",
                  border: "1px solid rgba(110,106,232,0.15)",
                }}
              >
                <CheckCircle className="w-7 h-7" style={{ color: "#6E6AE8" }} />
              </div>
              <p
                className="text-sm leading-relaxed mb-7"
                style={{ color: "#6B7280" }}
              >
                Check your inbox and follow the link to reset your password. The
                link expires in 30 minutes.
              </p>
              <Link
                href={ROUTES.LOGIN}
                className="inline-flex items-center gap-2 text-sm font-medium transition-opacity hover:opacity-70"
                style={{ color: "#6E6AE8" }}
              >
                <ArrowLeft className="w-4 h-4" /> Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
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
                    onChange={(event) => setEmail(event.target.value)}
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

              {error && (
                <p className="text-sm text-red-500" role="alert">
                  {error}
                </p>
              )}

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
                    Send reset link <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <Link
                href={ROUTES.LOGIN}
                className="flex items-center justify-center gap-2 text-sm transition-opacity hover:opacity-70"
                style={{ color: "#6B7280" }}
              >
                <ArrowLeft className="w-4 h-4" /> Back to sign in
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
