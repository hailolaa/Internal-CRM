"use client";

const steps = [
  {
    number: "01",
    title: "Connect your clinic",
    body: "We plug into your ad accounts, call tracking, and booking system. Setup takes under 60 minutes with a dedicated onboarding specialist.",
    detail:
      "Google Ads, Meta Ads, call tracking, and booking data — unified in one view.",
  },
  {
    number: "02",
    title: "See the full picture",
    body: "Your Revenue Command Centre lights up. Every lead, every call, every booking, every pound — tracked from first touch to treatment completion.",
    detail: "Real-time dashboards, AI growth briefs, and automated alerts.",
  },
  {
    number: "03",
    title: "Grow with clarity",
    body: "Make decisions based on data, not guesswork. Know exactly where to invest, what to fix, and which levers to pull for predictable growth.",
    detail:
      "Weekly growth briefs, campaign recommendations, and revenue forecasts.",
  },
];

export default function HowItWorks() {
  return (
    <section
      className="py-24 md:py-32 px-6"
      style={{
        backgroundColor: "#FFFFFF",
        borderTop: "1px solid rgba(0,0,0,0.05)",
      }}
    >
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <p
            className="text-xs font-semibold uppercase tracking-[0.2em] mb-4"
            style={{ color: "rgba(110,106,232,0.7)" }}
          >
            How it works
          </p>
          <h2
            className="text-3xl md:text-4xl font-bold tracking-tight"
            style={{ color: "#111111" }}
          >
            Live in under 60 minutes
          </h2>
          <p
            className="mt-5 max-w-lg mx-auto text-[15px] leading-relaxed"
            style={{ color: "#6B7280" }}
          >
            No months-long implementation. No complex migration. Connect, see,
            grow.
          </p>
        </div>

        <div className="space-y-0">
          {steps.map((step, i) => (
            <div
              key={step.number}
              className="relative grid grid-cols-1 md:grid-cols-[80px_1fr] gap-6 md:gap-10 py-12"
              style={{
                borderBottom:
                  i < steps.length - 1 ? "1px solid rgba(0,0,0,0.06)" : "none",
              }}
            >
              {/* Number */}
              <div className="flex-shrink-0">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold"
                  style={{
                    backgroundColor: "rgba(110,106,232,0.07)",
                    color: "#6E6AE8",
                    border: "1px solid rgba(110,106,232,0.15)",
                  }}
                >
                  {step.number}
                </div>
              </div>

              {/* Content */}
              <div>
                <h3
                  className="text-xl md:text-2xl font-bold mb-3"
                  style={{ color: "#111111", letterSpacing: "-0.02em" }}
                >
                  {step.title}
                </h3>
                <p
                  className="text-[15px] leading-[1.75] mb-4"
                  style={{ color: "#4B5563" }}
                >
                  {step.body}
                </p>
                <div
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5"
                  style={{
                    backgroundColor: "rgba(110,106,232,0.04)",
                    border: "1px solid rgba(110,106,232,0.10)",
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: "#6E6AE8" }}
                  />
                  <span
                    className="text-xs font-medium"
                    style={{ color: "#6E6AE8" }}
                  >
                    {step.detail}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
