"use client";

import Link from "next/link";
import { ROUTES } from "@/lib/constants";
import { ArrowRight, CheckCircle } from "lucide-react";
import MarketingHero from "@/components/marketing/MarketingHero";
import TrustBar from "@/components/marketing/TrustBar";
import PlatformOverview from "@/components/marketing/PlatformOverview";
import HowItWorks from "@/components/marketing/HowItWorks";
import CallIntelligenceSection from "@/components/marketing/CallIntelligenceSection";
import AIGrowthSection from "@/components/marketing/AIGrowthSection";
import ForAgenciesSection from "@/components/marketing/ForAgenciesSection";
import ForClinicGroupsSection from "@/components/marketing/ForClinicGroupsSection";
import TestimonialsSection from "@/components/marketing/TestimonialsSection";
import FinalCTA from "@/components/marketing/FinalCTA";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import ClinicGrowerLogo from "@/components/brand/ClinicGrowerLogo";

const leakagePoints = [
  {
    number: "01",
    title: "Missed calls",
    body: "Patient enquiries are lost before anyone measures them.",
  },
  {
    number: "02",
    title: "Slow follow-up",
    body: "Leads cool down when response times slip.",
  },
  {
    number: "03",
    title: "Unbooked consultations",
    body: "Interested patients never make it into the calendar.",
  },
  {
    number: "04",
    title: "Poor call conversion",
    body: "Reception performance is rarely visible enough to improve.",
  },
  {
    number: "05",
    title: "Attribution blindness",
    body: "Clinics spend on marketing without knowing what creates booked patients.",
  },
  {
    number: "06",
    title: "No-show leakage",
    body: "Revenue disappears when reminders, deposits and follow-up are inconsistent.",
  },
];

const tiers = [
  {
    name: "Starter",
    price: "£299",
    highlight: false,
    features: [
      "Revenue Dashboard",
      "Lead & Pipeline Tracking",
      "Campaign ROI",
      "Basic Retention",
      "Core CRM",
      "Solo practitioners",
      "5,000 contacts",
    ],
  },
  {
    name: "Professional",
    price: "£599",
    highlight: true,
    features: [
      "Everything in Starter",
      "Call Intelligence",
      "AI Growth Insights",
      "Marketing Attribution",
      "Practitioner Benchmarking",
      "2–5 practitioners",
      "15,000 contacts",
    ],
  },
  {
    name: "Growth",
    price: "£999",
    highlight: false,
    features: [
      "Everything in Professional",
      "Advanced Analytics",
      "Multi-location",
      "Priority Support",
      "5+ practitioners",
      "Unlimited contacts",
    ],
  },
];

export default function LandingPage() {
  return (
    <div
      className="min-h-screen text-[#111111]"
      style={{ backgroundColor: "#FAF8F5" }}
    >
      {/* ── 1. Nav ── */}
      <nav
        className="sticky top-0 z-50"
        style={{
          backgroundColor: "rgba(250,248,245,0.88)",
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          borderBottom: "1px solid rgba(0,0,0,0.04)",
        }}
      >
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8 lg:px-12 h-[60px] flex items-center justify-between">
          {/* Logo */}
          <Link href={ROUTES.HOME} className="flex items-center flex-shrink-0">
            <span className="flex sm:hidden">
              <ClinicGrowerLogo variant="compact" />
            </span>
            <span className="hidden sm:flex">
              <ClinicGrowerLogo variant="full" />
            </span>
          </Link>

          {/* Nav links — desktop */}
          <div className="hidden md:flex items-center gap-8">
            <a
              href="#platform"
              className="text-[13px] font-medium transition-colors hover:text-[#111111]"
              style={{ color: "#6B7280", letterSpacing: "-0.01em" }}
            >
              Platform
            </a>
            <a
              href="#pricing"
              className="text-[13px] font-medium transition-colors hover:text-[#111111]"
              style={{ color: "#6B7280", letterSpacing: "-0.01em" }}
            >
              Pricing
            </a>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-3 sm:gap-5 flex-shrink-0">
            <Link
              href={ROUTES.LOGIN}
              className="text-[13px] font-medium transition-colors hover:text-[#111111] whitespace-nowrap"
              style={{ color: "#6B7280" }}
            >
              Sign In
            </Link>
            <Link
              href={ROUTES.SIGNUP}
              className="px-5 py-2 text-[13px] font-semibold text-white rounded-xl transition-all duration-200 hover:opacity-90 whitespace-nowrap"
              style={{
                backgroundColor: "#6E6AE8",
                boxShadow: "0 2px 8px rgba(110,106,232,0.18)",
              }}
            >
              Sign up
            </Link>
          </div>
        </div>
      </nav>

      {/* ── 2. Hero ── */}
      <MarketingHero />

      {/* ── 3. Trust Bar ── */}
      <TrustBar />

      {/* ── 4. Revenue Leakage ── */}
      <section
        className="py-28 md:py-36 px-6"
        style={{
          backgroundColor: "#FFFFFF",
          borderTop: "1px solid rgba(0,0,0,0.05)",
        }}
      >
        <div className="max-w-[1100px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-start">
            <div className="lg:sticky lg:top-28">
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.2em] mb-5"
                style={{ color: "rgba(110,106,232,0.65)" }}
              >
                Revenue Leakage
              </p>
              <h2
                className="text-[1.75rem] md:text-[2.25rem] font-bold tracking-[-0.035em] leading-[1.08] mb-6"
                style={{ color: "#111111" }}
              >
                Your clinic is leaking revenue in places you cannot see.
              </h2>
              <p
                className="text-[15px] leading-[1.8] mb-10"
                style={{ color: "#6B7280" }}
              >
                Most clinics do not lose growth because demand is missing. They
                lose it between the enquiry, the call, the follow-up, the
                consultation and the booking.
              </p>
              <div
                className="rounded-2xl px-6 py-5"
                style={{
                  backgroundColor: "rgba(110,106,232,0.04)",
                  border: "1px solid rgba(110,106,232,0.10)",
                }}
              >
                <p
                  className="text-sm leading-relaxed font-medium"
                  style={{ color: "#111111" }}
                >
                  ClinicGrower surfaces these gaps before they become lost
                  revenue.
                </p>
              </div>
            </div>

            <div className="space-y-0">
              {leakagePoints.map((point, i) => (
                <div
                  key={point.number}
                  className="flex gap-5 py-8"
                  style={{
                    borderBottom:
                      i < leakagePoints.length - 1
                        ? "1px solid rgba(0,0,0,0.06)"
                        : "none",
                  }}
                >
                  <div className="flex-shrink-0 pt-0.5">
                    <span
                      className="text-[11px] font-bold tabular-nums"
                      style={{
                        color: "rgba(110,106,232,0.40)",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {point.number}
                    </span>
                  </div>
                  <div>
                    <p
                      className="text-[15px] font-semibold mb-1.5"
                      style={{ color: "#111111", letterSpacing: "-0.01em" }}
                    >
                      {point.title}
                    </p>
                    <p
                      className="text-sm leading-relaxed"
                      style={{ color: "#6B7280" }}
                    >
                      {point.body}
                    </p>
                  </div>
                  <div className="flex-shrink-0 pt-1.5 ml-auto pl-4">
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: "rgba(110,106,232,0.20)" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. Platform Overview ── */}
      <PlatformOverview />

      {/* ── 6. How It Works ── */}
      <HowItWorks />

      {/* ── 7. Call Intelligence ── */}
      <CallIntelligenceSection />

      {/* ── 8. AI Growth Insights ── */}
      <AIGrowthSection />

      {/* ── 9. For Agencies ── */}
      <ForAgenciesSection />

      {/* ── 10. For Clinic Groups ── */}
      <ForClinicGroupsSection />

      {/* ── 11. Testimonials ── */}
      <TestimonialsSection />

      {/* ── 12. Pricing ── */}
      <section
        id="pricing"
        className="py-28 md:py-36 px-6"
        style={{
          backgroundColor: "#FFFFFF",
          borderTop: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        <div className="max-w-[1000px] mx-auto">
          <div className="text-center mb-16">
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.2em] mb-4"
              style={{ color: "rgba(110,106,232,0.65)" }}
            >
              Transparent pricing
            </p>
            <h2 className="text-[1.75rem] md:text-[2.25rem] font-bold tracking-[-0.035em] text-[#111111]">
              Simple, Transparent Pricing
            </h2>
            <p className="mt-5 text-[15px]" style={{ color: "#6B7280" }}>
              Start with Starter. Scale as your clinic grows. Annual billing
              saves 2 months.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {tiers.map((tier) => (
              <div
                key={tier.name}
                className="p-7"
                style={{
                  background: "#FFFFFF",
                  borderRadius: "24px",
                  border: tier.highlight
                    ? "1.5px solid rgba(110,106,232,0.30)"
                    : "1px solid rgba(0,0,0,0.06)",
                  boxShadow: tier.highlight
                    ? "0 4px 24px rgba(110,106,232,0.06)"
                    : "0 1px 12px rgba(0,0,0,0.03)",
                }}
              >
                {tier.highlight && (
                  <div
                    className="text-[10px] font-semibold uppercase tracking-[0.15em] mb-3"
                    style={{ color: "#6E6AE8" }}
                  >
                    Most Popular
                  </div>
                )}
                <h3 className="text-lg font-bold text-[#111111]">
                  {tier.name}
                </h3>
                <div className="mt-3">
                  <span className="text-3xl font-bold tracking-tight text-[#111111]">
                    {tier.price}
                  </span>
                  <span className="text-sm" style={{ color: "#9CA3AF" }}>
                    /month
                  </span>
                </div>
                <div className="mt-7 space-y-3.5">
                  {tier.features.map((f) => (
                    <div key={f} className="flex items-center gap-2.5">
                      <CheckCircle
                        className="w-4 h-4 flex-shrink-0"
                        style={{ color: "#6E6AE8" }}
                      />
                      <span className="text-sm" style={{ color: "#374151" }}>
                        {f}
                      </span>
                    </div>
                  ))}
                </div>
                <Link
                  href={ROUTES.SIGNUP}
                  className="block w-full mt-8 py-3 text-sm font-semibold text-center transition-all duration-200 hover:opacity-90"
                  style={
                    tier.highlight
                      ? {
                          backgroundColor: "#6E6AE8",
                          color: "#FFFFFF",
                          borderRadius: "14px",
                          boxShadow: "0 2px 8px rgba(110,106,232,0.20)",
                        }
                      : {
                          backgroundColor: "rgba(0,0,0,0.03)",
                          color: "#111111",
                          borderRadius: "14px",
                          border: "1px solid rgba(0,0,0,0.08)",
                        }
                  }
                >
                  Discuss This Package
                </Link>
              </div>
            ))}
          </div>
          <p className="text-xs text-center mt-6" style={{ color: "#9CA3AF" }}>
            Enterprise pricing available on request. No free tier — setup fee
            £500–£1,000.
          </p>
        </div>
      </section>

      {/* ── 13. Final CTA ── */}
      <FinalCTA />

      {/* ── 14. Footer ── */}
      <MarketingFooter />
    </div>
  );
}
