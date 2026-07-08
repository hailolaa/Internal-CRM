"use client";

import { BarChart3, Phone, Users, Brain, Zap, Shield } from "lucide-react";

const capabilities = [
  {
    icon: BarChart3,
    title: "Revenue Command Centre",
    desc: "See exactly where revenue is growing, stalling, or leaking — by treatment, practitioner, and campaign.",
  },
  {
    icon: Phone,
    title: "Call Intelligence",
    desc: "Track every inbound call. Know who answered, who didn't, and which calls converted to bookings.",
  },
  {
    icon: Users,
    title: "Lead & Pipeline Tracking",
    desc: "Follow every lead from first touch to booked consultation. Understand where leads stall or drop off.",
  },
  {
    icon: Brain,
    title: "AI Growth Insights",
    desc: "Weekly growth briefs, campaign analysis, conversion predictions, and revenue opportunity alerts — automatically.",
  },
  {
    icon: Zap,
    title: "Automation Engine",
    desc: "Automated reminders, follow-ups, deposit requests, and rebooking sequences that run while you treat patients.",
  },
  {
    icon: Shield,
    title: "Compliance & Consent",
    desc: "GDPR-compliant consent tracking, audit logs, and data retention policies built into every workflow.",
  },
];

export default function PlatformOverview() {
  return (
    <section
      id="platform"
      className="py-24 md:py-32 px-6"
      style={{ backgroundColor: "#FAF8F5" }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <p
            className="text-xs font-semibold uppercase tracking-[0.2em] mb-4"
            style={{ color: "rgba(110,106,232,0.7)" }}
          >
            Purpose-built for clinics
          </p>
          <h2
            className="text-3xl md:text-4xl font-bold tracking-tight"
            style={{ color: "#111111" }}
          >
            Clarity across every layer of your clinic
          </h2>
          <p
            className="mt-5 max-w-xl mx-auto leading-relaxed text-[15px]"
            style={{ color: "#6B7280" }}
          >
            One clear operating system for leads, calls, bookings, revenue and
            marketing performance. Built to give clinic owners visibility
            without operational noise.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {capabilities.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="group p-7 transition-all duration-300 hover:shadow-md"
                style={{
                  background: "#FFFFFF",
                  borderRadius: "28px",
                  border: "1px solid rgba(0,0,0,0.06)",
                  boxShadow: "0 1px 12px rgba(0,0,0,0.03)",
                }}
              >
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center mb-5"
                  style={{
                    backgroundColor: "rgba(110,106,232,0.07)",
                    border: "1px solid rgba(110,106,232,0.12)",
                  }}
                >
                  <Icon className="w-5 h-5 text-[#6E6AE8]" />
                </div>
                <h3
                  className="text-base font-semibold mb-2.5"
                  style={{ color: "#111111" }}
                >
                  {f.title}
                </h3>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "#6B7280" }}
                >
                  {f.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
