"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui";
import { ProgressBar } from "@/components/ui/layout";
import { api } from "@/lib/api-client";
import type { BillingStatus } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";

const tiers = [
  {
    name: "Starter",
    price: "£299",
    period: "/month",
    planType: "starter",
    features: [
      "Revenue Dashboard",
      "Lead & Pipeline Tracking",
      "Campaign ROI",
      "Basic Retention",
      "Core CRM",
      "Up to 2 team members",
      "Up to 5,000 contacts",
    ],
    cta: "Current Plan",
    color: "indigo",
  },
  {
    name: "Professional",
    price: "£599",
    period: "/month",
    planType: "professional",
    features: [
      "Everything in Starter",
      "Call Intelligence",
      "AI Growth Insights",
      "Marketing Attribution",
      "Practitioner Benchmarking",
      "Up to 5 practitioners",
      "Up to 15,000 contacts",
    ],
    cta: "Upgrade",
    color: "amber",
  },
  {
    name: "Growth",
    price: "£999",
    period: "/month",
    planType: null,
    features: [
      "Everything in Professional",
      "Advanced Analytics",
      "Multi-location",
      "Priority Support",
      "5+ practitioners",
      "Unlimited contacts",
    ],
    cta: "Upgrade",
    color: "purple",
  },
];

const invoices = [
  { date: "01 May 2026", amount: "£299.00", status: "Paid", plan: "Starter" },
  { date: "01 Apr 2026", amount: "£299.00", status: "Paid", plan: "Starter" },
  { date: "01 Mar 2026", amount: "£299.00", status: "Paid", plan: "Starter" },
];

function formatRenewalDate(value: string | null) {
  if (!value) return "No renewal date set";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatPlanName(plan: string | null | undefined) {
  if (!plan) return "Starter";
  return plan
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function usagePercent(value: number, max: number) {
  if (!max) return 0;
  return Math.min(100, Math.round((value / max) * 100));
}

export default function BillingPage() {
  const { session } = useAuth();
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingOut, setIsCheckingOut] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.token) return;

    let cancelled = false;

    async function loadBillingStatus() {
      try {
        setIsLoading(true);
        const status = await api.billing.getStatus(session!.token);
        if (!cancelled) {
          setBillingStatus(status);
          setStatusMessage(null);
        }
      } catch (error) {
        console.error("Failed to load billing status", error);
        if (!cancelled) {
          setStatusMessage("Using plan defaults until billing status loads.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadBillingStatus();

    return () => {
      cancelled = true;
    };
  }, [session]);

  const currentPlan = billingStatus?.subscriptionPlan ?? "starter";
  const normalizedCurrentPlan = currentPlan.toLowerCase();
  const usage = billingStatus?.usage;

  const planSummary = useMemo(() => {
    const plan = tiers.find((tier) =>
      normalizedCurrentPlan.includes(tier.name.toLowerCase()),
    );
    return plan ?? tiers[0];
  }, [normalizedCurrentPlan]);

  const handleCheckout = async (planType: "starter" | "professional") => {
    if (!session?.token) return;

    try {
      setIsCheckingOut(planType);
      const checkout = await api.billing.createCheckout(session.token, planType, {
        cancelUrl: window.location.href,
        successUrl: `${window.location.origin}/app/settings/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      });

      if (checkout.url) {
        window.location.assign(checkout.url);
        return;
      }

      setStatusMessage("Checkout session created, but no redirect URL was returned.");
    } catch (error) {
      console.error("Failed to create checkout session", error);
      setStatusMessage("Could not start checkout. Please try again.");
    } finally {
      setIsCheckingOut(null);
    }
  };

  return (
    <div className="space-y-8">
      {statusMessage && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {statusMessage}
        </div>
      )}

      {/* Current Plan + Usage */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <div className="text-xs text-[#6B7280] uppercase tracking-wider mb-1">
            Current Plan
          </div>
          <div className="text-xl font-bold text-[#111111]">
            {isLoading ? "Loading..." : formatPlanName(currentPlan)}
          </div>
          <div className="text-sm text-[#6B7280] mt-1">
            {planSummary.price}/month ·{" "}
            {billingStatus?.subscriptionStatus
              ? `${formatPlanName(billingStatus.subscriptionStatus)} · `
              : ""}
            {formatRenewalDate(billingStatus?.planExpiresAt ?? null)}
          </div>
        </Card>
        <Card>
          <div className="text-xs text-[#6B7280] uppercase tracking-wider mb-2">
            Usage
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[#6B7280]">Team Members</span>
                <span className="font-medium text-[#111111]">
                  {usage ? `${usage.teamMembers} / ${usage.maxUsers}` : "0 / 0"}
                </span>
              </div>
              <ProgressBar
                value={usage ? usagePercent(usage.teamMembers, usage.maxUsers) : 0}
                max={100}
                color="violet"
              />
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[#6B7280]">Contacts</span>
                <span className="font-medium text-[#111111]">
                  {usage ? usage.contacts.toLocaleString("en-GB") : "0"} /{" "}
                  {normalizedCurrentPlan.includes("growth")
                    ? "Unlimited"
                    : normalizedCurrentPlan.includes("professional")
                      ? "15,000"
                      : "5,000"}
                </span>
              </div>
              <ProgressBar
                value={
                  usage
                    ? usagePercent(
                        usage.contacts,
                        normalizedCurrentPlan.includes("professional")
                          ? 15000
                          : 5000,
                      )
                    : 0
                }
                max={100}
                color="violet"
              />
            </div>
          </div>
        </Card>
      </div>

      {/* Pricing Tiers */}
      <div>
        <h2 className="text-lg font-semibold text-[#111111] mb-4">
          Plans & Pricing
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tiers.map((tier) => {
            const current = normalizedCurrentPlan.includes(
              tier.name.toLowerCase(),
            );
            const isDisabled = current || !tier.planType || isCheckingOut !== null;

            return (
            <div
              key={tier.name}
              className={`bg-[#FFFCF9] border rounded-[24px] p-6 ${current ? "border-[rgba(110,106,232,0.4)] ring-1 ring-[rgba(110,106,232,0.15)]" : "border-[rgba(0,0,0,0.06)]"}`}
            >
              {current && (
                <div
                  className="text-[10px] font-semibold uppercase tracking-[0.15em] mb-3"
                  style={{ color: "#6E6AE8" }}
                >
                  CURRENT PLAN
                </div>
              )}
              <h3 className="text-lg font-bold text-[#111111]">{tier.name}</h3>
              <div className="mt-2">
                <span className="text-3xl font-bold tracking-tight text-[#111111]">
                  {tier.price}
                </span>
                <span className="text-sm" style={{ color: "#9CA3AF" }}>
                  {tier.period}
                </span>
              </div>
              <div className="mt-5 space-y-2.5">
                {tier.features.map((f) => (
                  <div key={f} className="flex items-center gap-2">
                    <span
                      className={`text-xs ${tier.color === "indigo" ? "text-[#6E6AE8]" : tier.color === "amber" ? "text-amber-500" : "text-purple-500"}`}
                    >
                      ✓
                    </span>
                    <span className="text-sm" style={{ color: "#374151" }}>
                      {f}
                    </span>
                  </div>
                ))}
              </div>
              <button
                onClick={() =>
                  tier.planType
                    ? handleCheckout(tier.planType as "starter" | "professional")
                    : setStatusMessage("Growth plan setup is handled by the team.")
                }
                className={`w-full mt-6 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90 ${
                  current
                    ? "bg-[rgba(0,0,0,0.04)] text-[#6B7280] cursor-default"
                    : tier.color === "amber"
                      ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white"
                      : "bg-gradient-to-r from-purple-500 to-indigo-600 text-white"
                }`}
                disabled={isDisabled}
              >
                {isCheckingOut === tier.planType
                  ? "Opening Checkout..."
                  : current
                    ? "Current Plan"
                    : tier.planType
                      ? tier.cta
                      : "Contact Team"}
              </button>
            </div>
            );
          })}
        </div>
        <p className="text-xs text-[#9CA3AF] mt-4 text-center">
          Annual billing available — save 2 months. Enterprise pricing available
          on request.
        </p>
      </div>

      {/* Invoice History */}
      <Card padding="p-0">
        <div className="px-5 py-4 border-b border-[rgba(0,0,0,0.06)]">
          <h2 className="text-sm font-semibold text-[#111111]">
            Invoice History
          </h2>
        </div>
        <div className="divide-y divide-[rgba(0,0,0,0.04)]">
          {invoices.map((inv) => (
            <div
              key={inv.date}
              className="px-5 py-3.5 flex items-center justify-between"
            >
              <div>
                <div className="text-sm text-[#111111]">{inv.date}</div>
                <div className="text-xs text-[#6B7280]">{inv.plan}</div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold text-[#111111]">
                  {inv.amount}
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 text-xs font-medium">
                  {inv.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
