"use client";

import { ArrowRight, CheckCircle } from "lucide-react";
import Link from "next/link";
import { ROUTES } from "@/lib/constants";

const agencyBenefits = [
  "White-label revenue dashboards for your clinic clients",
  "Prove ROI with attribution data your clients can see",
  "Reduce churn by showing exactly where growth is happening",
  "Call intelligence shows front-desk accountability",
  "Automated reporting saves 10+ hours per week per client",
  "One platform for all your clinic clients — multi-tenant ready",
];

export default function ForAgenciesSection() {
  return (
    <section
      className="py-24 md:py-32 px-6"
      style={{
        backgroundColor: "#FAF8F5",
        borderTop: "1px solid rgba(0,0,0,0.05)",
      }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-20 items-center">
          {/* Left: copy */}
          <div>
            <p
              className="text-xs font-semibold uppercase tracking-[0.2em] mb-5"
              style={{ color: "rgba(110,106,232,0.7)" }}
            >
              For Agencies
            </p>
            <h2
              className="text-3xl md:text-4xl font-bold tracking-tight leading-[1.08] mb-6"
              style={{ color: "#111111", letterSpacing: "-0.03em" }}
            >
              Give your clinic clients the visibility they&apos;ve been asking
              for.
            </h2>
            <p
              className="text-[15px] leading-[1.75] mb-8"
              style={{ color: "#4B5563" }}
            >
              Agencies that manage clinic marketing need more than ad
              dashboards. ClinicGrower connects your campaigns to actual
              bookings and revenue — so you can prove ROI, reduce churn, and
              scale your retainer.
            </p>

            <div className="space-y-3.5 mb-10">
              {agencyBenefits.map((benefit) => (
                <div key={benefit} className="flex items-start gap-3">
                  <CheckCircle
                    className="w-4 h-4 flex-shrink-0 mt-0.5"
                    style={{ color: "#5A8A6A" }}
                  />
                  <span
                    className="text-sm leading-relaxed"
                    style={{ color: "#374151" }}
                  >
                    {benefit}
                  </span>
                </div>
              ))}
            </div>

            <Link
              href={ROUTES.SIGNUP}
              className="inline-flex items-center gap-2 px-7 py-3.5 text-sm font-bold text-white transition-all hover:opacity-90"
              style={{
                background: "#6E6AE8",
                borderRadius: "14px",
                boxShadow: "0 4px 16px rgba(110,106,232,0.3)",
              }}
            >
              Partner With Us <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Right: visual card */}
          <div
            className="rounded-[28px] p-8 md:p-10"
            style={{
              background:
                "linear-gradient(160deg, #FDFBF7 0%, #F5F2EE 40%, #EDE8E2 100%)",
              border: "1px solid rgba(0,0,0,0.06)",
              boxShadow:
                "0 4px 40px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)",
            }}
          >
            <p
              className="text-xs font-semibold uppercase tracking-[0.15em] mb-6"
              style={{ color: "#6E6AE8" }}
            >
              Agency Dashboard Preview
            </p>
            <div className="space-y-4">
              {[
                {
                  clinic: "Glow Aesthetics",
                  revenue: "£47,200",
                  leads: 42,
                  conversion: "68%",
                },
                {
                  clinic: "Beauty Bar London",
                  revenue: "£31,800",
                  leads: 28,
                  conversion: "54%",
                },
                {
                  clinic: "Skin Deep Clinic",
                  revenue: "£62,400",
                  leads: 67,
                  conversion: "72%",
                },
              ].map((row) => (
                <div
                  key={row.clinic}
                  className="flex items-center justify-between p-4 rounded-2xl"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.8)",
                    border: "1px solid rgba(0,0,0,0.06)",
                  }}
                >
                  <div>
                    <p
                      className="font-semibold text-sm"
                      style={{ color: "#111111" }}
                    >
                      {row.clinic}
                    </p>
                    <p className="text-xs" style={{ color: "#6B7280" }}>
                      {row.leads} leads this month
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className="font-bold text-lg"
                      style={{ color: "#111111" }}
                    >
                      {row.revenue}
                    </p>
                    <p
                      className="text-xs font-medium"
                      style={{ color: "#5A8A6A" }}
                    >
                      {row.conversion} conversion
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
