"use client";

import {
  Newspaper,
  Brain,
  MessageSquare,
  BarChart3,
  PoundSterling,
} from "lucide-react";

const modules = [
  {
    icon: Newspaper,
    title: "Weekly Growth Brief",
    desc: "Your weekly performance digest — wins, risks, insights, and revenue opportunities surfaced automatically every Monday morning.",
  },
  {
    icon: Brain,
    title: "Campaign Analysis",
    desc: "Input your ad spend and revenue data. Get actionable recommendations on where to scale, where to cut, and projected uplift.",
  },
  {
    icon: MessageSquare,
    title: "Conversion Tracking",
    desc: "Follow-up strategies, cold lead flags, and conversion predictions for your active pipeline. Never lose a warm lead again.",
  },
  {
    icon: BarChart3,
    title: "Missed Opportunity Tracking",
    desc: "Predict no-shows before they happen. Trigger reminders and enforce deposit policies automatically.",
  },
  {
    icon: PoundSterling,
    title: "ROI Reporting",
    desc: "High-value patient segments, rebooking timing gaps, cross-sell opportunities, and under-monetised treatment categories.",
  },
];

export default function AIGrowthSection() {
  return (
    <section
      className="py-24 md:py-32 px-6"
      style={{
        backgroundColor: "#FFFFFF",
        borderTop: "1px solid rgba(0,0,0,0.05)",
      }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <p
            className="text-xs font-semibold uppercase tracking-[0.2em] mb-4"
            style={{ color: "rgba(110,106,232,0.7)" }}
          >
            AI Growth Intelligence
          </p>
          <h2
            className="text-3xl md:text-4xl font-bold tracking-tight"
            style={{ color: "#111111" }}
          >
            Your clinic&apos;s intelligence layer
          </h2>
          <p
            className="mt-5 max-w-2xl mx-auto text-[15px] leading-relaxed"
            style={{ color: "#6B7280" }}
          >
            ClinicGrower doesn&apos;t just show you data — it tells you what it
            means, what to do about it, and what revenue you&apos;re leaving on
            the table.
          </p>
        </div>

        {/* Bento-style grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {modules.map((mod, i) => {
            const Icon = mod.icon;
            const isLarge = i === 0;
            return (
              <div
                key={mod.title}
                className={`p-7 transition-all duration-300 hover:shadow-md ${
                  isLarge ? "md:col-span-2 lg:col-span-2" : ""
                }`}
                style={{
                  background: isLarge
                    ? "linear-gradient(135deg, rgba(110,106,232,0.04) 0%, rgba(90,138,106,0.04) 100%)"
                    : "#FFFFFF",
                  borderRadius: "28px",
                  border: isLarge
                    ? "1px solid rgba(110,106,232,0.12)"
                    : "1px solid rgba(0,0,0,0.06)",
                  boxShadow: "0 1px 12px rgba(0,0,0,0.03)",
                }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: "rgba(110,106,232,0.07)",
                      border: "1px solid rgba(110,106,232,0.12)",
                    }}
                  >
                    <Icon className="w-5 h-5 text-[#6E6AE8]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h3
                        className="text-base font-semibold"
                        style={{ color: "#111111" }}
                      >
                        {mod.title}
                      </h3>
                      <span
                        className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: "rgba(90,138,106,0.08)",
                          color: "#5A8A6A",
                          border: "1px solid rgba(90,138,106,0.15)",
                        }}
                      >
                        Live
                      </span>
                    </div>
                    <p
                      className="text-sm leading-relaxed"
                      style={{ color: "#6B7280" }}
                    >
                      {mod.desc}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
