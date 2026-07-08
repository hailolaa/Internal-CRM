"use client";

import {
  Phone,
  PhoneOff,
  Clock,
  TrendingUp,
  BarChart3,
  Brain,
} from "lucide-react";

const callFeatures = [
  {
    icon: Phone,
    title: "Every call tracked",
    desc: "Inbound and outbound calls logged automatically. Know who called, when, and what happened.",
  },
  {
    icon: PhoneOff,
    title: "Missed call alerts",
    desc: "Instant notifications when calls go unanswered. Every missed call is a potential lost booking.",
  },
  {
    icon: Clock,
    title: "Speed-to-lead monitoring",
    desc: "Track how quickly your team responds. Clinics that respond in under 5 minutes convert 3× more.",
  },
  {
    icon: TrendingUp,
    title: "Call-to-booking conversion",
    desc: "See which team members convert calls into consultations — and who needs coaching.",
  },
  {
    icon: BarChart3,
    title: "Peak hour analysis",
    desc: "Know your busiest call windows. Staff accordingly and never miss high-intent enquiries.",
  },
  {
    icon: Brain,
    title: "AI call scoring",
    desc: "Every call scored on greeting, discovery, objection handling, and close. Coaching flags surfaced automatically.",
  },
];

export default function CallIntelligenceSection() {
  return (
    <section
      className="py-24 md:py-32 px-6"
      style={{
        backgroundColor: "#FAF8F5",
        borderTop: "1px solid rgba(0,0,0,0.05)",
      }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-20 items-start">
          {/* Left: narrative */}
          <div className="lg:sticky lg:top-28">
            <p
              className="text-xs font-semibold uppercase tracking-[0.2em] mb-5"
              style={{ color: "rgba(110,106,232,0.7)" }}
            >
              Call Intelligence
            </p>
            <h2
              className="text-3xl md:text-4xl font-bold tracking-tight leading-[1.08] mb-6"
              style={{ color: "#111111", letterSpacing: "-0.03em" }}
            >
              Your phone is your highest-value sales channel. Start treating it
              that way.
            </h2>
            <p
              className="text-[15px] md:text-base leading-[1.75] mb-8"
              style={{ color: "#4B5563" }}
            >
              Most clinics have no idea how many calls they miss, how long it
              takes to respond, or which team members convert enquiries into
              bookings. ClinicGrower changes that.
            </p>

            {/* Stat callout */}
            <div
              className="rounded-2xl p-6"
              style={{
                background:
                  "linear-gradient(135deg, rgba(110,106,232,0.06) 0%, rgba(90,138,106,0.06) 100%)",
                border: "1px solid rgba(110,106,232,0.12)",
              }}
            >
              <div className="grid grid-cols-3 gap-6 text-center">
                {[
                  { value: "5 min", label: "Target response time" },
                  { value: "3×", label: "Higher conversion" },
                  { value: "£18k", label: "Annual recovery" },
                ].map((s) => (
                  <div key={s.label}>
                    <p
                      className="text-2xl font-bold tracking-tight"
                      style={{ color: "#6E6AE8" }}
                    >
                      {s.value}
                    </p>
                    <p className="text-xs mt-1" style={{ color: "#6B7280" }}>
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: feature list */}
          <div className="space-y-5">
            {callFeatures.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="p-6 transition-all duration-300 hover:shadow-md"
                  style={{
                    background: "#FFFFFF",
                    borderRadius: "24px",
                    border: "1px solid rgba(0,0,0,0.06)",
                    boxShadow: "0 1px 8px rgba(0,0,0,0.03)",
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{
                        backgroundColor: "rgba(110,106,232,0.07)",
                        border: "1px solid rgba(110,106,232,0.12)",
                      }}
                    >
                      <Icon className="w-5 h-5 text-[#6E6AE8]" />
                    </div>
                    <div>
                      <h3
                        className="text-[15px] font-semibold mb-1"
                        style={{ color: "#111111" }}
                      >
                        {feature.title}
                      </h3>
                      <p
                        className="text-sm leading-relaxed"
                        style={{ color: "#6B7280" }}
                      >
                        {feature.desc}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
