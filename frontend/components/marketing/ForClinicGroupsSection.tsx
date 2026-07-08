"use client";

import {
  Building2,
  BarChart3,
  Users,
  Globe,
  ArrowRight,
  CheckCircle,
} from "lucide-react";
import Link from "next/link";
import { ROUTES } from "@/lib/constants";

const groupFeatures = [
  {
    icon: BarChart3,
    title: "Cross-location reporting",
    desc: "Unified revenue, lead, and conversion dashboards across all your clinic locations.",
  },
  {
    icon: Globe,
    title: "Brand-level overview",
    desc: "Executive view of performance, benchmarking, and trends across your entire brand.",
  },
  {
    icon: Users,
    title: "Location benchmarking",
    desc: "Compare locations on revenue, conversion, practitioner performance, and retention.",
  },
  {
    icon: Building2,
    title: "Centralised operations",
    desc: "One platform for team management, compliance, and SOPs across every location.",
  },
];

export default function ForClinicGroupsSection() {
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
            For Clinic Groups
          </p>
          <h2
            className="text-3xl md:text-4xl font-bold tracking-tight"
            style={{ color: "#111111" }}
          >
            One command centre for every location
          </h2>
          <p
            className="mt-5 max-w-2xl mx-auto text-[15px] leading-relaxed"
            style={{ color: "#6B7280" }}
          >
            Multi-location clinic groups need visibility across every site
            without the noise. ClinicGrower scales with you — from 2 locations
            to 20.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-12">
          {groupFeatures.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="p-7 transition-all duration-300 hover:shadow-md"
                style={{
                  background: "#FAF8F5",
                  borderRadius: "28px",
                  border: "1px solid rgba(0,0,0,0.06)",
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
                    <h3
                      className="text-base font-semibold mb-1.5"
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

        <div className="text-center">
          <Link
            href={ROUTES.SIGNUP}
            className="inline-flex items-center gap-2 px-7 py-3.5 text-sm font-bold transition-all hover:opacity-90"
            style={{
              background: "linear-gradient(135deg, #111111 0%, #2A2A2A 100%)",
              color: "#FFFFFF",
              borderRadius: "14px",
              boxShadow:
                "0 6px 24px rgba(0,0,0,0.22), 0 2px 6px rgba(0,0,0,0.12)",
            }}
          >
            Discuss Enterprise Pricing <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
