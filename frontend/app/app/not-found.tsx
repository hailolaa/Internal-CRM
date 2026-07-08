"use client";

import Link from "next/link";
import { Home, ArrowLeft, Search } from "lucide-react";

export default function AppNotFound() {
  return (
    <div
      className="flex items-center justify-center min-h-[60vh] p-6"
      style={{ backgroundColor: "#FAF8F5" }}
    >
      <div
        className="text-center max-w-md w-full"
        style={{
          backgroundColor: "#FFFCF9",
          borderRadius: "28px",
          border: "1px solid rgba(0,0,0,0.06)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)",
          padding: "2.5rem 2rem",
        }}
      >
        <div className="relative mb-8">
          <div
            className="text-[100px] font-bold leading-none tracking-tighter"
            style={{ color: "rgba(110,106,232,0.08)" }}
          >
            404
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{
                backgroundColor: "rgba(110,106,232,0.07)",
                border: "1px solid rgba(110,106,232,0.12)",
              }}
            >
              <Search className="w-8 h-8" style={{ color: "#6E6AE8" }} />
            </div>
          </div>
        </div>

        <h1 className="text-xl font-bold mb-2" style={{ color: "#111111" }}>
          Page not found
        </h1>
        <p className="text-sm mb-8" style={{ color: "#6B7280" }}>
          This page doesn&apos;t exist yet or has been moved. Head back to the
          dashboard.
        </p>

        <div className="flex items-center justify-center gap-3">
          <Link
            href="/app/revenue"
            className="px-5 py-2.5 text-white font-semibold rounded-xl flex items-center gap-2 hover:opacity-90 transition-all text-sm"
            style={{ backgroundColor: "#6E6AE8" }}
          >
            <Home className="w-4 h-4" /> Dashboard
          </Link>
          <Link
            href="/app/crm/contacts"
            className="px-5 py-2.5 font-medium rounded-xl flex items-center gap-2 hover:bg-[#F3F0EC] transition-colors text-sm"
            style={{
              backgroundColor: "rgba(0,0,0,0.04)",
              color: "#111111",
              border: "1px solid rgba(0,0,0,0.08)",
            }}
          >
            <ArrowLeft className="w-4 h-4" /> Contacts
          </Link>
        </div>
      </div>
    </div>
  );
}
