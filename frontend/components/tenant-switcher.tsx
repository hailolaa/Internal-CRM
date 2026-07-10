"use client";

import { useState } from "react";
import { Building2, ChevronDown, Check, Shield } from "lucide-react";
import { useTenant } from "@/lib/tenant-context";
import { getRoleLabel, normaliseUserRole } from "@/lib/roles";

export function TenantSwitcher() {
  const { clinic, user, allClinics, switchClinic } = useTenant();
  const [isOpen, setIsOpen] = useState(false);

  const isSuperAdmin = user.role === "SUPER_ADMIN";

  return (
    <div className="relative">
      <button
        onClick={() => isSuperAdmin && setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-colors"
        style={{
          border: "1px solid #d8ddda",
          backgroundColor: "transparent",
          cursor: isSuperAdmin ? "pointer" : "default",
        }}
        onMouseOver={(e) => {
          if (isSuperAdmin)
            (e.currentTarget as HTMLElement).style.backgroundColor = "#eaedeb";
        }}
        onMouseOut={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor =
            "transparent";
        }}
      >
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center"
          style={{ backgroundColor: "rgba(96, 180, 175, 0.1)" }}
        >
          <Building2 className="w-3.5 h-3.5 text-[#60b4af]" />
        </div>
        <div className="text-left hidden sm:block">
          <p
            className="text-xs font-semibold leading-tight"
            style={{ color: "#151f21" }}
          >
            {clinic.name}
          </p>
          <p className="text-[10px]" style={{ color: "#5e8a8d" }}>
            {clinic.id} · {clinic.plan}
          </p>
        </div>
        {isSuperAdmin && <ChevronDown className="w-3 h-3 text-[#A8A39B]" />}
      </button>

      {isOpen && isSuperAdmin && (
        <>
          <div
            data-gsap-overlay
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div
            data-gsap-popover
            className="absolute top-full left-0 mt-1 w-72 rounded-xl shadow-xl z-50 overflow-hidden animate-scale-in"
            style={{
              backgroundColor: "#FFFCF9",
              border: "1px solid #d8ddda",
              boxShadow: "0 20px 60px rgba(21, 31, 33, 0.12)",
            }}
          >
            <div
              className="px-4 py-3"
              style={{
                borderBottom: "1px solid #d8ddda",
                backgroundColor: "#eaedeb",
              }}
            >
              <p
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: "#5e8a8d" }}
              >
                Switch Workspace
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: "#A8A39B" }}>
                Data remains scoped to the selected internal workspace
              </p>
            </div>
            <div className="py-1">
              {allClinics.map((c) => (
                <button
                  key={c.id}
                  data-gsap-list-item
                  onClick={() => {
                    switchClinic(c.id);
                    setIsOpen(false);
                  }}
                  className="w-full px-4 py-3 flex items-center gap-3 transition-colors text-left"
                  style={{
                    backgroundColor:
                      c.id === clinic.id
                        ? "rgba(96, 180, 175, 0.06)"
                        : "transparent",
                  }}
                  onMouseOver={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      "#eaedeb";
                  }}
                  onMouseOut={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      c.id === clinic.id
                        ? "rgba(96, 180, 175, 0.06)"
                        : "transparent";
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{
                      backgroundColor:
                        c.id === clinic.id
                          ? "rgba(96, 180, 175, 0.1)"
                          : "#eaedeb",
                    }}
                  >
                    <Building2
                      className={`w-4 h-4 ${c.id === clinic.id ? "text-[#60b4af]" : "text-[#A8A39B]"}`}
                    />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p
                      className="text-sm font-semibold truncate"
                      style={{ color: "#151f21" }}
                    >
                      {c.name}
                    </p>
                    <div
                      className="flex items-center gap-2 text-[10px]"
                      style={{ color: "#5e8a8d" }}
                    >
                      <span>{c.id}</span>
                      <span>·</span>
                      <span>{c.plan}</span>
                      <span>·</span>
                      <span
                        style={{
                          color: c.status === "active" ? "#60b4af" : "#b7672e",
                        }}
                      >
                        {c.status}
                      </span>
                    </div>
                  </div>
                  {c.id === clinic.id && (
                    <Check className="w-4 h-4 text-[#60b4af] flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
            <div
              className="px-4 py-3"
              style={{
                borderTop: "1px solid #d8ddda",
                backgroundColor: "#eaedeb",
              }}
            >
              <div
                className="flex items-center gap-2 text-[10px]"
                style={{ color: "#5e8a8d" }}
              >
                <Shield className="w-3 h-3" />
                <span>Super Admin: cross-workspace access enabled</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function TenantBadge() {
  const { clinic, user } = useTenant();
  const displayRole = normaliseUserRole(user.role);

  return (
    <div
      className="flex items-center gap-2 px-2.5 py-1 rounded-lg"
      style={{ backgroundColor: "#eaedeb", border: "1px solid #d8ddda" }}
    >
      <Building2 className="w-3.5 h-3.5 text-[#60b4af]" />
      <span className="text-[10px] font-mono" style={{ color: "#5e8a8d" }}>
        {clinic.id}
      </span>
      <span className="text-[10px]" style={{ color: "#A8A39B" }}>
        |
      </span>
      <span
        className="text-[10px] font-bold"
        style={{
          color:
            displayRole === "SUPER_ADMIN"
              ? "#b7672e"
              : displayRole === "ADMIN"
                ? "#60b4af"
                : displayRole === "DELIVERY"
                  ? "#5e8a8d"
                  : "#5e8a8d",
        }}
      >
        {getRoleLabel(user.role)}
      </span>
    </div>
  );
}
