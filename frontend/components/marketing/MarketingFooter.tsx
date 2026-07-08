"use client";

import Link from "next/link";
import { ROUTES } from "@/lib/constants";
import ClinicGrowerLogo from "@/components/brand/ClinicGrowerLogo";

const footerLinks = {
  Product: [
    { label: "Revenue Dashboard", href: "#platform" },
    { label: "Call Intelligence", href: "#platform" },
    { label: "AI Growth Insights", href: "#platform" },
    { label: "Pricing", href: "#pricing" },
  ],
  Company: [
    { label: "About", href: "#" },
    { label: "Blog", href: "#" },
    { label: "Careers", href: "#" },
    { label: "Contact", href: "#" },
  ],
  Legal: [
    { label: "Privacy Policy", href: "#" },
    { label: "Terms of Service", href: "#" },
    { label: "GDPR", href: "#" },
    { label: "Cookie Policy", href: "#" },
  ],
};

export default function MarketingFooter() {
  return (
    <footer
      className="pt-16 pb-8 px-6"
      style={{
        backgroundColor: "#FFFFFF",
        borderTop: "1px solid rgba(0,0,0,0.06)",
      }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          {/* Brand column */}
          <div className="md:col-span-1">
            <ClinicGrowerLogo variant="full" />
            <p
              className="text-sm leading-relaxed mt-4 max-w-xs"
              style={{ color: "#6B7280" }}
            >
              The performance command centre for ambitious clinics. Revenue
              intelligence, lead management, call intelligence and AI growth
              insights.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <p
                className="text-xs font-semibold uppercase tracking-[0.15em] mb-4"
                style={{ color: "#111111" }}
              >
                {title}
              </p>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm transition-colors hover:text-[#6E6AE8]"
                      style={{ color: "#6B7280" }}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div
          className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4"
          style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}
        >
          <p className="text-xs" style={{ color: "#9CA3AF" }}>
            &copy; {new Date().getFullYear()} ClinicGrower. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link
              href={ROUTES.LOGIN}
              className="text-xs transition-colors hover:text-[#6E6AE8]"
              style={{ color: "#6B7280" }}
            >
              Sign In
            </Link>
            <Link
              href={ROUTES.SIGNUP}
              className="text-xs font-semibold transition-colors hover:opacity-80"
              style={{ color: "#6E6AE8" }}
            >
              Sign up
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
