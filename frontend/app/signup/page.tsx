"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Lock, User } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { ROUTES } from "@/lib/constants";
import { useToggle } from "@/hooks";
import SignupLuxuryShell from "@/components/auth/SignupLuxuryShell";

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("inviteToken")?.trim() || "";
  const { value: showPassword, toggle: togglePassword } = useToggle(false);
  const [isLoading, setIsLoading] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteToken) {
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      await api.team.acceptInvite({
        token: inviteToken,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        password,
      });
      router.push(ROUTES.APP);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Unable to accept this invitation. Please ask an admin to resend it.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!inviteToken) {
    return (
      <SignupLuxuryShell
        title="Invitation required"
        description="Mission Control accounts are created by internal team invitation only."
      >
        <div className="space-y-5 text-center">
          <p className="text-sm leading-relaxed text-[#6F6875]">
            Ask a Super Admin or Admin to invite you from Team Members. After
            accepting the invite, you can sign in normally.
          </p>
          <Link
            href={ROUTES.LOGIN}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition-all"
            style={{ backgroundColor: "#6E6AE8" }}
          >
            Go to sign in <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </SignupLuxuryShell>
    );
  }

  return (
    <SignupLuxuryShell>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="mb-1.5 block text-sm text-[#6F6875]">
            First name
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#6F6875]" />
            <input
              type="text"
              placeholder="Sarah"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="input-with-icon"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm text-[#6F6875]">
            Last name
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#6F6875]" />
            <input
              type="text"
              placeholder="Smith"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="input-with-icon"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm text-[#6F6875]">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#6F6875]" />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Letter, number, and symbol"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-with-icon pr-11"
            />
            <button
              type="button"
              onClick={togglePassword}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6F6875] hover:text-[#1F1A24]"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
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
          className="flex w-full items-center justify-center gap-2 rounded-xl py-3 font-semibold text-white transition-all disabled:opacity-50"
          style={{ backgroundColor: "#6E6AE8" }}
        >
          {isLoading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <>
              Accept invitation <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-[#6F6875]">
        Already accepted your invite?{" "}
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

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupContent />
    </Suspense>
  );
}
