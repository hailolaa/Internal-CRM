import React from "react";
import Link from "next/link";
import { ROUTES } from "@/lib/constants";
import ClinicGrowerLogo from "@/components/brand/ClinicGrowerLogo";

interface SignupLuxuryShellProps {
  children: React.ReactNode;
}

export default function SignupLuxuryShell({
  children,
}: SignupLuxuryShellProps) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: "#FAF8F5" }}
    >
      <div className="w-full max-w-md">
        {/* Logo + Header */}
        <div className="text-center mb-8">
          <Link href={ROUTES.HOME} className="inline-flex justify-center mb-6">
            {/* Mobile: compact icon only */}
            <span className="flex sm:hidden">
              <ClinicGrowerLogo variant="compact" />
            </span>
            {/* Tablet/Desktop: full lockup */}
            <span className="hidden sm:flex">
              <ClinicGrowerLogo variant="full" />
            </span>
          </Link>
          <h1
            className="text-[1.75rem] font-semibold tracking-tight mb-3"
            style={{ color: "#111111" }}
          >
            Start your clinic growth OS
          </h1>
          <p
            className="text-sm leading-relaxed max-w-xs mx-auto"
            style={{ color: "#6B7280" }}
          >
            Create your account and bring leads, calls, bookings and revenue
            into one calm operating system.
          </p>
        </div>

        {/* Card */}
        <div
          className="w-full"
          style={{
            backgroundColor: "#FFFCF9",
            borderRadius: "28px",
            border: "1px solid rgba(0,0,0,0.06)",
            boxShadow:
              "0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)",
            padding: "2rem 2.25rem",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
