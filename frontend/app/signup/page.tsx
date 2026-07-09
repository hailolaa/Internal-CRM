"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Mail, Lock, ArrowRight, Eye, EyeOff, User } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { ROUTES } from "@/lib/constants";
import { useToggle } from "@/hooks";
import SignupLuxuryShell from "@/components/auth/SignupLuxuryShell";

export default function SignupPage() {
  const router = useRouter();
  const { value: showPassword, toggle: togglePassword } = useToggle(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const [firstName, ...restName] = fullName.trim().split(/\s+/);

    try {
      const session = await api.auth.registerClinic({
        clinicName: clinicName.trim(),
        adminEmail: email.trim(),
        adminPassword: password,
        firstName: firstName || "Clinic",
        lastName: restName.join(" ") || "Admin",
      });
      if (!session.user.emailVerifiedAt) {
        router.push(
          `${ROUTES.VERIFY_EMAIL}?email=${encodeURIComponent(session.user.email)}`,
        );
        return;
      }

      router.push(ROUTES.APP);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Unable to create your account. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuth = (provider: "google" | "facebook" | "apple") => {
    window.location.assign(api.auth.getOAuthUrl(provider, "signup", true));
  };

  return (
    <SignupLuxuryShell>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm text-[#6F6875] mb-1.5">
            Full name
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6F6875]" />
            <input
              type="text"
              placeholder="Dr. Sarah Smith"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input-with-icon"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm text-[#6F6875] mb-1.5">
            Clinic name
          </label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6F6875]" />
            <input
              type="text"
              placeholder="Glow Aesthetics"
              required
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
              className="input-with-icon"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm text-[#6F6875] mb-1.5">
            Email address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6F6875]" />
            <input
              type="email"
              placeholder="sarah@glowclinic.co.uk"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-with-icon"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm text-[#6F6875] mb-1.5">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6F6875]" />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Min 8 characters"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-with-icon pr-11"
            />
            <button
              type="button"
              onClick={togglePassword}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6F6875] hover:text-[#1F1A24]"
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {error && (
          <p className="rounded-xl border border-[#9A5524]/20 bg-[#9A5524]/10 px-3 py-2 text-sm text-[#9A5524]">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full disabled:opacity-50 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
          style={{ backgroundColor: "#6E6AE8" }}
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              Create account <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[#E7E1DA]" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="px-2 bg-[#FFFCF9] text-[#6F6875]">
            or sign up with
          </span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => handleOAuth("google")}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-[#E7E1DA] rounded-xl hover:bg-[#EFEAFB] transition-colors text-sm text-[#1F1A24]"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Google
        </button>
        <button
          type="button"
          onClick={() => handleOAuth("facebook")}
          className="flex items-center justify-center gap-2 px-3 py-2.5 bg-white border border-[#E7E1DA] rounded-xl hover:bg-[#EFEAFB] transition-colors text-sm text-[#1F1A24]"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded bg-[#1877F2] text-[12px] font-bold text-white">
            f
          </span>
          Facebook
        </button>
        <button
          type="button"
          onClick={() => handleOAuth("apple")}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-[#E7E1DA] rounded-xl hover:bg-[#EFEAFB] transition-colors text-sm text-[#1F1A24]"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
          </svg>
          Apple
        </button>
      </div>

      <p className="text-xs text-[#6F6875] text-center mt-6">
        By signing up, you agree to our{" "}
        <Link href="/terms" className="hover:underline" style={{ color: "#6E6AE8" }}>
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="hover:underline" style={{ color: "#6E6AE8" }}>
          Privacy Policy
        </Link>
      </p>

      <p className="text-center text-sm text-[#6F6875] mt-4">
        Already have an account?{" "}
        <Link
          href={ROUTES.LOGIN}
          className="font-medium hover:underline"
          style={{ color: "#6E6AE8" }}
        >
          Sign in
        </Link>
      </p>
    </SignupLuxuryShell>
  );
}
