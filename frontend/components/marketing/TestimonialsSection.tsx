"use client";

import { Star } from "lucide-react";

const testimonials = [
  {
    quote:
      "We were spending £4k a month on ads with no idea what was converting. ClinicGrower showed us 40% of our leads were going cold because of slow follow-up. We fixed it in a week and bookings jumped 22%.",
    name: "Dr. Sarah Mitchell",
    role: "Owner, Glow Aesthetics London",
    metric: "+22% bookings",
    rating: 5,
  },
  {
    quote:
      "The call intelligence alone paid for itself. We discovered our receptionist was missing 8 calls a day during lunch. Staggered breaks, added auto-SMS, and recovered £3,200 in the first month.",
    name: "James Park",
    role: "Operations Director, Skin Deep Clinic",
    metric: "£3,200 recovered",
    rating: 5,
  },
  {
    quote:
      "As an agency managing 12 clinic accounts, ClinicGrower gives us the attribution data we need to prove ROI. Client retention went from 6 months average to 14 months.",
    name: "Emma Chen",
    role: "Founder, Aesthetic Growth Agency",
    metric: "14-month retention",
    rating: 5,
  },
];

export default function TestimonialsSection() {
  return (
    <section
      className="py-24 md:py-32 px-6"
      style={{
        backgroundColor: "#FAF8F5",
        borderTop: "1px solid rgba(0,0,0,0.05)",
      }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <p
            className="text-xs font-semibold uppercase tracking-[0.2em] mb-4"
            style={{ color: "rgba(110,106,232,0.7)" }}
          >
            What clinic owners say
          </p>
          <h2
            className="text-3xl md:text-4xl font-bold tracking-tight"
            style={{ color: "#111111" }}
          >
            Results that speak for themselves
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="p-7 flex flex-col justify-between transition-all duration-300 hover:shadow-md"
              style={{
                background: "#FFFFFF",
                borderRadius: "28px",
                border: "1px solid rgba(0,0,0,0.06)",
                boxShadow: "0 1px 12px rgba(0,0,0,0.03)",
              }}
            >
              <div>
                {/* Stars */}
                <div className="flex gap-0.5 mb-5">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star
                      key={i}
                      className="w-4 h-4 text-amber-400 fill-amber-400"
                    />
                  ))}
                </div>

                {/* Quote */}
                <p
                  className="text-sm leading-[1.75] mb-6"
                  style={{ color: "#374151" }}
                >
                  &ldquo;{t.quote}&rdquo;
                </p>
              </div>

              <div>
                {/* Metric badge */}
                <div
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 mb-4"
                  style={{
                    backgroundColor: "rgba(90,138,106,0.08)",
                    border: "1px solid rgba(90,138,106,0.15)",
                  }}
                >
                  <span
                    className="text-xs font-semibold"
                    style={{ color: "#5A8A6A" }}
                  >
                    {t.metric}
                  </span>
                </div>

                {/* Author */}
                <div>
                  <p
                    className="text-sm font-semibold"
                    style={{ color: "#111111" }}
                  >
                    {t.name}
                  </p>
                  <p className="text-xs" style={{ color: "#6B7280" }}>
                    {t.role}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
