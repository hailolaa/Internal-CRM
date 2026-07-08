"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle } from "lucide-react";
import { ROUTES } from "@/lib/constants";

export default function FinalCTA() {
  return (
    <section
      className="py-24 md:py-32 px-6"
      style={{ backgroundColor: "#FAF8F5" }}
    >
      <div className="max-w-4xl mx-auto">
        <div
          className="relative overflow-hidden rounded-[32px] px-8 py-16 md:px-16 md:py-20 text-center"
          style={{
            background:
              "linear-gradient(160deg, #111111 0%, #1A1A2E 50%, #2A2A3E 100%)",
            boxShadow:
              "0 24px 64px rgba(0,0,0,0.25), 0 4px 16px rgba(0,0,0,0.15)",
          }}
        >
          {/* Accent blobs */}
          <div
            className="absolute -top-20 -right-20 w-[300px] h-[300px] rounded-full opacity-[0.15]"
            style={{
              background:
                "radial-gradient(circle, #6E6AE8 0%, transparent 70%)",
            }}
          />
          <div
            className="absolute -bottom-20 -left-20 w-[200px] h-[200px] rounded-full opacity-[0.10]"
            style={{
              background:
                "radial-gradient(circle, #5A8A6A 0%, transparent 70%)",
            }}
          />

          <div className="relative z-10">
            <p
              className="text-xs font-semibold uppercase tracking-[0.2em] mb-6"
              style={{ color: "rgba(110,106,232,0.8)" }}
            >
              Ready to stop the leakage?
            </p>
            <h2
              className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.05] mb-6 text-white"
              style={{ letterSpacing: "-0.04em" }}
            >
              Book your free growth audit.
              <br />
              <span style={{ color: "rgba(110,106,232,0.9)" }}>
                See exactly where revenue is leaking.
              </span>
            </h2>
            <p
              className="text-[15px] md:text-base leading-relaxed max-w-xl mx-auto mb-10"
              style={{ color: "rgba(255,255,255,0.6)" }}
            >
              A 30-minute call where we audit your current marketing, calls, and
              booking flow — and show you exactly where you&apos;re losing
              revenue. No pitch. No pressure. Just clarity.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
              <Link
                href={ROUTES.SIGNUP}
                className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-10 py-4 text-[15px] font-bold text-white transition-all hover:opacity-90 hover:-translate-y-0.5"
                style={{
                  background: "#6E6AE8",
                  borderRadius: "16px",
                  boxShadow: "0 6px 24px rgba(110,106,232,0.4)",
                }}
              >
                Book Your Free Growth Audit
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
              {[
                "No setup fee for early adopters",
                "Live in under 60 minutes",
                "Cancel anytime",
              ].map((item) => (
                <span
                  key={item}
                  className="flex items-center gap-1.5 text-[13px]"
                  style={{ color: "rgba(255,255,255,0.5)" }}
                >
                  <CheckCircle
                    className="w-3.5 h-3.5 flex-shrink-0"
                    style={{ color: "rgba(90,138,106,0.7)" }}
                  />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
