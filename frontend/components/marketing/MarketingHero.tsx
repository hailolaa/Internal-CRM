"use client";

import Link from "next/link";
import { ROUTES } from "@/lib/constants";
import {
  ArrowRight,
  Play,
  TrendingUp,
  Brain,
  Phone,
  Calendar,
} from "lucide-react";

/* ——— Executive Dashboard Mockup ——— */
function DashboardMockup() {
  return (
    <div
      className="w-full select-none"
      style={{
        borderRadius: "24px",
        overflow: "hidden",
        backgroundColor: "#FFFCF9",
        border: "1px solid #E7E1DA",
        boxShadow:
          "0 32px 80px rgba(0,0,0,0.07), 0 12px 32px rgba(0,0,0,0.03), 0 0 0 1px rgba(0,0,0,0.02)",
      }}
    >
      {/* —— Top bar —— */}
      <div
        className="flex items-center justify-between px-6 py-3.5"
        style={{
          borderBottom: "1px solid #EDE8E2",
          backgroundColor: "#FAF8F5",
        }}
      >
        <p
          className="text-[10px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: "#9CA3AF" }}
        >
          Revenue Command Centre
        </p>
        <p className="text-[10px] font-medium" style={{ color: "#C4BDB4" }}>
          Live · May 2026
        </p>
      </div>

      <div className="p-5 sm:p-6 space-y-5">
        {/* —— Hero metric row —— */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
          {/* Primary metric — dominant */}
          <div
            className="sm:col-span-2 rounded-2xl p-5 sm:p-6"
            style={{
              backgroundColor: "rgba(110,106,232,0.03)",
              border: "1px solid rgba(110,106,232,0.10)",
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: "rgba(110,106,232,0.07)" }}
              >
                <TrendingUp
                  className="w-3.5 h-3.5"
                  style={{ color: "#6E6AE8" }}
                />
              </div>
              <span
                className="text-[10px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: "#6B7280" }}
              >
                Attributed Monthly Revenue
              </span>
            </div>
            <div className="flex items-end gap-3">
              <p
                className="text-[2.5rem] sm:text-[3rem] font-bold tracking-[-0.04em] leading-none"
                style={{ color: "#111111" }}
              >
                £47,200
              </p>
              <span
                className="text-[13px] font-semibold mb-1.5 px-2 py-0.5 rounded-md"
                style={{
                  color: "#5A8A6A",
                  backgroundColor: "rgba(90,138,106,0.07)",
                }}
              >
                +12% vs last month
              </span>
            </div>
          </div>

          {/* Secondary metrics — stacked */}
          <div className="flex flex-row sm:flex-col gap-3 sm:gap-4">
            <div
              className="flex-1 rounded-xl p-4"
              style={{
                backgroundColor: "#FFFCF9",
                border: "1px solid #EDE8E2",
              }}
            >
              <div className="flex items-center gap-1.5 mb-2">
                <Phone className="w-3 h-3" style={{ color: "#6E6AE8" }} />
                <span
                  className="text-[9px] font-medium uppercase tracking-wider"
                  style={{ color: "#9CA3AF" }}
                >
                  Missed Calls
                </span>
              </div>
              <p
                className="text-xl font-bold tracking-tight"
                style={{ color: "#111111" }}
              >
                5
              </p>
              <p
                className="text-[10px] font-medium mt-0.5"
                style={{ color: "#5A8A6A" }}
              >
                −3 this week
              </p>
            </div>
            <div
              className="flex-1 rounded-xl p-4"
              style={{
                backgroundColor: "#FFFCF9",
                border: "1px solid #EDE8E2",
              }}
            >
              <div className="flex items-center gap-1.5 mb-2">
                <Calendar className="w-3 h-3" style={{ color: "#6E6AE8" }} />
                <span
                  className="text-[9px] font-medium uppercase tracking-wider"
                  style={{ color: "#9CA3AF" }}
                >
                  Booking Rate
                </span>
              </div>
              <p
                className="text-xl font-bold tracking-tight"
                style={{ color: "#111111" }}
              >
                68%
              </p>
              <p
                className="text-[10px] font-medium mt-0.5"
                style={{ color: "#5A8A6A" }}
              >
                +4% vs avg
              </p>
            </div>
          </div>
        </div>

        {/* —— Bottom row: Treatment performance + AI insight —— */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          {/* Treatment performance */}
          <div
            className="rounded-xl p-4 sm:p-5"
            style={{ backgroundColor: "#FAF8F5", border: "1px solid #EDE8E2" }}
          >
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.16em] mb-4"
              style={{ color: "#6B7280" }}
            >
              Treatment Performance
            </p>
            {[
              { name: "Botox", pct: 82, revenue: "£18.4k", color: "#6E6AE8" },
              {
                name: "Lip Filler",
                pct: 64,
                revenue: "£12.1k",
                color: "#8A9B86",
              },
              {
                name: "Dermal Filler",
                pct: 48,
                revenue: "£9.8k",
                color: "#A07840",
              },
            ].map((t) => (
              <div key={t.name} className="mb-3.5 last:mb-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className="text-[11px] font-medium"
                    style={{ color: "#374151" }}
                  >
                    {t.name}
                  </span>
                  <span
                    className="text-[11px] font-semibold"
                    style={{ color: t.color }}
                  >
                    {t.revenue}
                  </span>
                </div>
                <div
                  className="h-[6px] rounded-full overflow-hidden"
                  style={{ backgroundColor: "rgba(0,0,0,0.04)" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${t.pct}%`, backgroundColor: t.color }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* AI insight — elevated */}
          <div
            className="rounded-xl p-4 sm:p-5 flex flex-col justify-between"
            style={{
              backgroundColor: "rgba(110,106,232,0.03)",
              border: "1px solid rgba(110,106,232,0.10)",
            }}
          >
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: "rgba(110,106,232,0.07)" }}
                >
                  <Brain className="w-3.5 h-3.5" style={{ color: "#6E6AE8" }} />
                </div>
                <span
                  className="text-[10px] font-semibold uppercase tracking-[0.14em]"
                  style={{ color: "#6E6AE8" }}
                >
                  AI Insight
                </span>
              </div>
              <p
                className="text-[13px] leading-[1.7] font-medium"
                style={{ color: "#374151" }}
              >
                Botox enquiries are converting 3× faster this week. Reallocate
                £800 from dermal filler ads to capture the demand spike.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <div
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ backgroundColor: "#6E6AE8" }}
              />
              <span
                className="text-[10px] font-medium"
                style={{ color: "#9CA3AF" }}
              >
                Updated 4 minutes ago
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ——— Hero ——— */
export default function MarketingHero() {
  return (
    <section className="w-full" style={{ backgroundColor: "#FAF8F5" }}>
      <div className="max-w-[1200px] mx-auto px-5 sm:px-8 lg:px-12 pt-20 sm:pt-28 lg:pt-36 pb-8 sm:pb-12">
        {/* —— Centred editorial copy —— */}
        <div className="max-w-3xl mx-auto text-center">
          {/* Badge */}
          <div className="mb-7 sm:mb-8">
            <span
              className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] uppercase px-4 py-2"
              style={{
                color: "#6E6AE8",
                backgroundColor: "rgba(110,106,232,0.05)",
                borderRadius: "999px",
                border: "1px solid rgba(110,106,232,0.12)",
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ backgroundColor: "#6E6AE8" }}
              />
              Clinic Performance OS
            </span>
          </div>

          {/* Headline */}
          <h1
            className="text-[2.5rem] sm:text-[3.25rem] lg:text-[3.75rem] font-bold tracking-[-0.04em] leading-[1.06]"
            style={{ color: "#111111" }}
          >
            The Performance Command Centre for Ambitious Clinics
          </h1>

          {/* Subheadline */}
          <p
            className="mt-6 sm:mt-7 text-[15px] sm:text-base leading-[1.75] mx-auto"
            style={{ color: "#6B7280", maxWidth: "540px" }}
          >
            One operating system for your clinic&apos;s marketing, calls, leads and
            revenue. See what&apos;s working. Fix what&apos;s leaking.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 mt-9 sm:mt-10">
            <Link
              href={ROUTES.SIGNUP}
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-3.5 text-[14px] font-semibold text-white transition-all duration-200 hover:opacity-90 hover:-translate-y-0.5"
              style={{
                backgroundColor: "#6E6AE8",
                borderRadius: "14px",
                boxShadow:
                  "0 4px 16px rgba(110,106,232,0.22), 0 1px 3px rgba(110,106,232,0.10)",
                letterSpacing: "-0.01em",
              }}
            >
              Book Your Free Growth Audit
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href={ROUTES.LOGIN}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-7 py-3.5 text-[14px] font-medium transition-all duration-200 hover:opacity-80"
              style={{
                color: "#4B5563",
                backgroundColor: "transparent",
                borderRadius: "14px",
                border: "1px solid #E7E1DA",
              }}
            >
              <Play className="w-4 h-4" style={{ color: "#6E6AE8" }} />
              Watch 2-Min Demo
            </Link>
          </div>
        </div>

        {/* —— Full-width floating dashboard preview —— */}
        <div className="relative mt-16 sm:mt-20 lg:mt-24">
          {/* Glow */}
          <div
            className="absolute -inset-8 sm:-inset-12 rounded-[48px] opacity-40 blur-3xl pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(110,106,232,0.12) 0%, transparent 70%)",
            }}
          />
          <div className="relative max-w-[960px] mx-auto">
            <DashboardMockup />
          </div>
        </div>
      </div>
    </section>
  );
}
