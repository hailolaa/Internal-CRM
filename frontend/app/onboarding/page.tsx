"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import {
  Building2,
  MapPin,
  Phone,
  Globe,
  Users,
  Palette,
  CreditCard,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  ShieldCheck,
  Sparkles,
  Loader2,
} from "lucide-react";
import { ROUTES } from "@/lib/constants";
import { useStepWizard } from "@/hooks";
import OnboardingLuxuryShell from "@/components/auth/OnboardingLuxuryShell";
import { api, getStoredAuthSession } from "@/lib/api-client";
import { publicEnv } from "@/lib/env";

const STEPS = [
  { id: 1, title: "Clinic Details", icon: Building2 },
  { id: 2, title: "Location", icon: MapPin },
  { id: 3, title: "Team Size", icon: Users },
  { id: 4, title: "Branding", icon: Palette },
  { id: 5, title: "Choose Plan", icon: CreditCard },
];

const STEP_DESCRIPTIONS = [
  "Tell us about your clinic so we can personalise your experience.",
  "Where is your clinic located? This helps with local SEO features.",
  "How big is your team? This helps us recommend the right plan.",
  "Customise how The Growth Group Internal CRM looks and feels for your team.",
  "Start your subscription securely with Stripe, then launch your dashboard.",
];

const TEAM_SIZES = ["Just me", "2-5", "6-15", "16+"];
const SERVICES = [
  "Botox",
  "Fillers",
  "Skin Treatments",
  "Laser",
  "Body Contouring",
  "Hair Removal",
  "Dental",
  "Other",
];

const stripePromise = publicEnv.stripePublishableKey
  ? loadStripe(publicEnv.stripePublishableKey)
  : null;

const TRIAL_DAYS = 14;

const PLANS = [
  {
    name: "Starter",
    planType: "starter" as const,
    price: "£299",
    trial: `${TRIAL_DAYS}-day free trial`,
    strapline: "For clinics getting their growth system live.",
    features: ["Revenue dashboard", "Lead & pipeline tracking", "Campaign ROI", "Core CRM"],
  },
  {
    name: "Professional",
    planType: "professional" as const,
    price: "£599",
    trial: `${TRIAL_DAYS}-day free trial`,
    strapline: "For clinics that need call intelligence and attribution.",
    features: [
      "Everything in Starter",
      "Call intelligence",
      "AI growth insights",
      "Marketing attribution",
    ],
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const wizard = useStepWizard(5);
  const { goTo } = wizard;
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"starter" | "professional">(
    "professional",
  );
  const [checkoutClientSecret, setCheckoutClientSecret] = useState<string | null>(
    null,
  );
  const [checkoutMessage, setCheckoutMessage] = useState("");
  const [checkoutPlan, setCheckoutPlan] = useState<
    "starter" | "professional" | null
  >(null);
  const [checkoutSessionId, setCheckoutSessionId] = useState<string | null>(null);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [checkoutComplete, setCheckoutComplete] = useState(false);
  const [teamSize, setTeamSize] = useState("2-5");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  const getCheckoutToken = useCallback(
    () => getStoredAuthSession()?.token || "",
    [],
  );

  useEffect(() => {
    const stored = getStoredAuthSession();

    if (!stored?.token) {
      router.replace(ROUTES.LOGIN);
      return;
    }

    if (!stored.user.emailVerifiedAt) {
      router.replace(
        `${ROUTES.VERIFY_EMAIL}?email=${encodeURIComponent(stored.user.email)}`,
      );
      return;
    }

    const timer = window.setTimeout(() => {
      setIsCheckingAccess(false);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [router]);

  useEffect(() => {
    if (isCheckingAccess) return;

    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const paymentState = params.get("payment");
      const sessionId =
        params.get("checkout_session_id") || params.get("session_id") || "";

      if (paymentState === "cancelled") {
        setCheckoutMessage("Checkout was cancelled. You can restart it below.");
        goTo(5);
        return;
      }

      if (paymentState !== "success") return;

      goTo(5);
      setCheckoutMessage("Payment complete. Syncing your subscription...");
      setCheckoutComplete(true);

      const token = getCheckoutToken();
      if (!token || !sessionId) {
        setCheckoutMessage("Payment complete. You can launch your dashboard.");
        return;
      }

      api.billing
        .getCheckoutSessionStatus(token, sessionId)
        .then(() => {
          setCheckoutMessage("Payment complete. Your subscription is active.");
        })
        .catch(() => {
          setCheckoutMessage(
            "Payment complete. Stripe may still be syncing your subscription.",
          );
        });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [getCheckoutToken, goTo, isCheckingAccess]);

  const syncCompletedCheckout = useCallback(
    async (sessionId: string | null) => {
      const token = getCheckoutToken();

      if (!token || !sessionId) {
        setCheckoutMessage("Payment complete. You can launch your dashboard.");
        return;
      }

      try {
        await api.billing.getCheckoutSessionStatus(token, sessionId);
        setCheckoutMessage("Payment complete. Your subscription is active.");
      } catch {
        setCheckoutMessage(
          "Payment complete. Stripe may still be syncing your subscription.",
        );
      }
    },
    [getCheckoutToken],
  );

  const handleEmbeddedCheckoutComplete = useCallback(() => {
    setCheckoutComplete(true);
    setCheckoutClientSecret(null);
    setCheckoutMessage("Payment complete. Syncing your subscription...");
    void syncCompletedCheckout(checkoutSessionId);
  }, [checkoutSessionId, syncCompletedCheckout]);

  const startCheckout = async (planType: "starter" | "professional") => {
    const token = getCheckoutToken();
    if (!token) {
      setCheckoutMessage("Your account session is still loading. Please wait a moment and try again.");
      return;
    }

    setSelectedPlan(planType);
    setCheckoutPlan(planType);
    setCheckoutMessage("");
    setCheckoutSessionId(null);

    try {
      const returnUrl = `${window.location.origin}/onboarding?payment=success&checkout_session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${window.location.origin}/onboarding?payment=cancelled`;
      const checkout = await api.billing.createCheckout(token, planType, {
        mode: stripePromise ? "embedded" : "hosted",
        returnUrl,
        successUrl: returnUrl,
        cancelUrl,
        trialDays: TRIAL_DAYS,
      });

      if (checkout.clientSecret && stripePromise) {
        setCheckoutSessionId(checkout.sessionId);
        setCheckoutClientSecret(checkout.clientSecret);
        setCheckoutComplete(false);
        return;
      }

      if (checkout.url) {
        window.location.assign(checkout.url);
        return;
      }

      setCheckoutMessage("Stripe checkout started, but no checkout form was returned.");
    } catch (error) {
      console.error("Failed to start onboarding checkout", error);
      setCheckoutMessage(
        error instanceof Error
          ? error.message
          : "Could not start Stripe checkout. Please try again.",
      );
    } finally {
      setCheckoutPlan(null);
    }
  };

  const handleNext = () => {
    if (wizard.isLast) {
      if (!checkoutComplete) {
        setCheckoutMessage("Complete secure checkout before launching your dashboard.");
        return;
      }

      setIsLoading(true);
      setTimeout(() => router.push(ROUTES.APP), 1500);
    } else {
      wizard.next();
    }
  };

  if (isCheckingAccess) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: "#FAF9F6" }}
      >
        <Loader2 className="h-8 w-8 animate-spin text-[#6E6AE8]" />
      </div>
    );
  }

  return (
    <OnboardingLuxuryShell>
      {/* Step indicator */}
      <div data-gsap-reveal className="flex items-center justify-between mb-6">
        {STEPS.map((s, i) => (
          <div key={s.id} data-gsap-step className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                  wizard.step > s.id
                    ? "text-white"
                    : wizard.step === s.id
                      ? "text-white"
                      : "text-[#6F6875]"
                }`}
                style={{
                  backgroundColor:
                    wizard.step > s.id
                      ? "#6E6AE8"
                      : wizard.step === s.id
                        ? "#6E6AE8"
                        : "#E7E1DA",
                }}
              >
                {wizard.step > s.id ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  s.id
                )}
              </div>
              <span
                className="text-[10px] hidden sm:block"
                style={{ color: wizard.step >= s.id ? "#111111" : "#9CA3AF" }}
              >
                {s.title}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className="flex-1 h-px mx-2 mb-4"
                style={{
                  backgroundColor: wizard.step > s.id ? "#6E6AE8" : "#E7E1DA",
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div
        data-gsap-reveal
        className="h-1 rounded-full mb-8"
        style={{ backgroundColor: "#F0EDE8" }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${wizard.progress}%`, backgroundColor: "#6E6AE8" }}
        />
      </div>

      <h2
        data-gsap-reveal
        className="text-lg font-semibold mb-1"
        style={{ color: "#111111" }}
      >
        {STEPS[wizard.step - 1].title}
      </h2>
      <p data-gsap-reveal className="text-sm mb-6" style={{ color: "#6B7280" }}>
        {STEP_DESCRIPTIONS[wizard.step - 1]}
      </p>

      <div key={wizard.step} data-gsap-step className="space-y-5">
        {wizard.step === 1 && (
          <>
            <div>
              <label className="block text-sm text-[#6F6875] mb-1.5">
                Clinic name
              </label>
              <input
                type="text"
                placeholder="Glow Aesthetics Clinic"
                className="input-base"
              />
            </div>
            <div>
              <label className="block text-sm text-[#6F6875] mb-1.5">
                Website (optional)
              </label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="url"
                  placeholder="https://glowclinic.co.uk"
                  className="input-with-icon"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-[#6F6875] mb-1.5">
                Phone number
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="tel"
                  placeholder="020 7123 4567"
                  className="input-with-icon"
                />
              </div>
            </div>
          </>
        )}

        {wizard.step === 2 && (
          <>
            <div>
              <label className="block text-sm text-[#6F6875] mb-1.5">
                Address line 1
              </label>
              <input
                type="text"
                placeholder="123 Harley Street"
                className="input-base"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-[#6F6875] mb-1.5">
                  City
                </label>
                <input
                  type="text"
                  placeholder="London"
                  className="input-base"
                />
              </div>
              <div>
                <label className="block text-sm text-[#6F6875] mb-1.5">
                  Postcode
                </label>
                <input
                  type="text"
                  placeholder="W1G 6AX"
                  className="input-base"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-[#6F6875] mb-1.5">
                Country
              </label>
              <select className="input-base">
                <option value="UK">United Kingdom</option>
                <option value="IE">Ireland</option>
              </select>
            </div>
          </>
        )}

        {wizard.step === 3 && (
          <>
            <div>
              <label className="block text-sm text-[#6F6875] mb-3">
                How many team members?
              </label>
              <div className="grid grid-cols-2 gap-3">
                {TEAM_SIZES.map((size) => (
                  <button
                    type="button"
                    key={size}
                    data-gsap-list-item
                    onClick={() => setTeamSize(size)}
                    className={`p-4 bg-[#FFFCF9] border rounded-xl hover:border-[#6E6AE8] focus:border-[#6E6AE8] transition-all text-left ${
                      teamSize === size ? "border-[#6E6AE8]" : "border-[#E7E1DA]"
                    }`}
                  >
                    <p className="font-medium text-[#111111]">{size}</p>
                    <p className="text-xs text-gray-500">
                      {size === "Just me"
                        ? "Solo practitioner"
                        : "team members"}
                    </p>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm text-[#6F6875] mb-3">
                Primary services offered
              </label>
              <div className="flex flex-wrap gap-2">
                {SERVICES.map((service) => (
                  <button
                    type="button"
                    key={service}
                    data-gsap-list-item
                    onClick={() =>
                      setSelectedServices((current) =>
                        current.includes(service)
                          ? current.filter((item) => item !== service)
                          : [...current, service],
                      )
                    }
                    className={`px-3 py-1.5 bg-[#FFFCF9] border rounded-full text-sm hover:border-[#6E6AE8] focus:border-[#6E6AE8] transition-all text-[#1F1A24] ${
                      selectedServices.includes(service)
                        ? "border-[#6E6AE8]"
                        : "border-[#E7E1DA]"
                    }`}
                  >
                    {service}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {wizard.step === 4 && (
          <>
            <div>
              <label className="block text-sm text-[#6F6875] mb-1.5">
                Brand colour
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  defaultValue="#6E6AE8"
                  className="w-12 h-12 rounded-xl border-0 cursor-pointer"
                />
                <input
                  type="text"
                  defaultValue="#6E6AE8"
                  className="flex-1 input-base"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-[#6F6875] mb-1.5">
                Brand tone
              </label>
              <select className="input-base">
                <option>Professional & Warm</option>
                <option>Luxury & Exclusive</option>
                <option>Friendly & Approachable</option>
                <option>Clinical & Expert</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-[#6F6875] mb-1.5">
                Logo (optional)
              </label>
              <div className="border-2 border-dashed border-[#E7E1DA] rounded-xl p-8 text-center hover:border-[#6E6AE8]/40 transition-colors cursor-pointer">
                <p className="text-[#6F6875] text-sm">
                  Drag and drop or click to upload
                </p>
                <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 2MB</p>
              </div>
            </div>
          </>
        )}

        {wizard.step === 5 && (
          <div className="space-y-5">
            {checkoutMessage && (
              <div className="rounded-xl border border-[#B7672E]/20 bg-[#B7672E]/10 px-3 py-2 text-sm text-[#9A5524]">
                {checkoutMessage}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PLANS.map((plan) => {
                const active = selectedPlan === plan.planType;
                return (
                  <button
                    key={plan.planType}
                    type="button"
                    data-gsap-step
                    onClick={() => setSelectedPlan(plan.planType)}
                    className={`text-left rounded-2xl border p-4 transition-all ${
                      active
                        ? "border-[#6E6AE8] bg-[#EFEAFB]"
                        : "border-[#E7E1DA] bg-[#FFFCF9] hover:border-[#6E6AE8]/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[#111111]">{plan.name}</p>
                        <p className="mt-2 inline-flex rounded-full bg-[#6E6AE8]/10 px-2.5 py-1 text-[11px] font-semibold text-[#5A56D4]">
                          {plan.trial}
                        </p>
                        <p className="text-xs text-[#6F6875] mt-1">
                          {plan.strapline}
                        </p>
                      </div>
                      {active && <CheckCircle className="w-5 h-5 text-[#6E6AE8]" />}
                    </div>
                    <p className="text-2xl font-bold text-[#111111] mt-4">
                      {plan.price}
                      <span className="text-xs font-medium text-[#6F6875]">
                        /month
                      </span>
                    </p>
                    <p className="mt-1 text-xs font-medium text-[#6F6875]">
                      No charge today. Billing starts after your trial.
                    </p>
                    <div className="space-y-1.5 mt-4">
                      {plan.features.map((feature) => (
                        <p
                          key={feature}
                          className="flex items-center gap-2 text-xs text-[#374151]"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-[#6E6AE8]" />
                          {feature}
                        </p>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => startCheckout(selectedPlan)}
              disabled={checkoutPlan !== null || checkoutComplete}
              className="w-full disabled:opacity-50 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-all text-sm"
              style={{ backgroundColor: "#6E6AE8" }}
            >
              {checkoutComplete ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Checkout complete
                </>
              ) : checkoutPlan ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Opening secure checkout...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  Start {TRIAL_DAYS}-day free trial
                </>
              )}
            </button>

            {checkoutClientSecret && stripePromise && (
              <div
                data-gsap-popover
                className="rounded-2xl border border-[#E7E1DA] bg-white p-2 sm:p-3"
              >
                <EmbeddedCheckoutProvider
                  stripe={stripePromise}
                  options={{
                    clientSecret: checkoutClientSecret,
                    onComplete: handleEmbeddedCheckoutComplete,
                  }}
                >
                  <EmbeddedCheckout />
                </EmbeddedCheckoutProvider>
              </div>
            )}

            <div
              data-gsap-reveal
              className="rounded-2xl bg-[#EFEAFB] border border-[#6E6AE8]/15 p-4"
            >
              <p className="flex items-center gap-2 font-semibold text-[#111111] text-sm">
                <Sparkles className="w-4 h-4 text-[#6E6AE8]" />
                Stripe handles payment details securely.
              </p>
              <p className="text-xs text-[#6F6875] mt-1 leading-relaxed">
                Add your payment method now. Stripe starts billing after the free
                trial unless you cancel before it ends.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-8">
        {!wizard.isFirst ? (
          <button
            onClick={wizard.prev}
            className="flex items-center gap-2 text-[#6F6875] hover:text-[#1F1A24] transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        ) : (
          <div />
        )}
        <button
          onClick={handleNext}
          disabled={isLoading || (wizard.isLast && !checkoutComplete)}
          className="disabled:opacity-50 text-white font-semibold px-6 py-3 rounded-xl flex items-center gap-2 transition-all text-sm"
          style={{ backgroundColor: "#6E6AE8" }}
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              {wizard.isLast
                ? checkoutComplete
                  ? "Launch Dashboard"
                  : "Complete Checkout"
                : "Continue"}{" "}
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </OnboardingLuxuryShell>
  );
}
