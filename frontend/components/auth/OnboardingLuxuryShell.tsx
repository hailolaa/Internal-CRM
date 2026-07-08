import React from "react";
import Link from "next/link";
import { ROUTES } from "@/lib/constants";
import ClinicGrowerLogo from "@/components/brand/ClinicGrowerLogo";

interface OnboardingLuxuryShellProps {
  children: React.ReactNode;
}

export default function OnboardingLuxuryShell({
  children,
}: OnboardingLuxuryShellProps) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 md:p-8"
      style={{ backgroundColor: "#FAF8F5" }}
    >
      <div className="w-full max-w-lg">
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
            Set up your clinic growth OS
          </h1>
          <p
            className="text-sm leading-relaxed max-w-sm mx-auto"
            style={{ color: "#6B7280" }}
          >
            Tell us about your team so The Growth Group Internal CRM can personalise your
            leads, calls, bookings and revenue dashboard.
          </p>
        </div>

        {/* Card */}
        <div
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
