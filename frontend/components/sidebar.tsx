"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useCallback, useState, useRef } from "react";
import {
  ChevronRight,
  ChevronDown,
  X,
  Lock,
} from "lucide-react";
import { NAV_SECTIONS, BOTTOM_NAV } from "@/lib/navigation";
import type { NavItem } from "@/lib/types";
import ClinicGrowerLogo from "@/components/brand/ClinicGrowerLogo";
import { useAuth } from "@/lib/auth-context";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

function NavItemLink({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const Icon = item.icon;
  const hasLock = !!item.badge;

  return (
    <Link
      href={item.href}
      data-gsap-nav-item
      className={`group flex items-center gap-3 px-3.5 py-2 rounded-2xl text-[13px] transition-all duration-250 ease-out ${
        isActive
          ? "font-semibold"
          : hasLock
            ? "text-[#A8A39B] hover:text-[#5e8a8d]"
            : "text-[#5e8a8d] hover:text-[#151f21] hover:bg-[#eaedeb]"
      }`}
      style={
        isActive
          ? {
              color: "#60b4af",
              backgroundColor: "rgba(96, 180, 175, 0.07)",
            }
          : undefined
      }
    >
      <Icon
        className={`w-[15px] h-[15px] flex-shrink-0 transition-colors duration-250 ease-out ${
          isActive
            ? ""
            : hasLock
              ? "text-[#d8ddda]"
              : "text-[#A8A39B] group-hover:text-[#5e8a8d]"
        }`}
        style={isActive ? { color: "#60b4af" } : undefined}
      />
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge === "coming-soon" && (
        <span className="flex items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#b7672e] bg-[rgba(183,103,46,0.08)] border border-[rgba(183,103,46,0.2)] px-1.5 py-0.5 rounded-lg">
          <Lock className="w-2.5 h-2.5" /> Soon
        </span>
      )}
      {item.badge === "premium" && (
        <span className="flex items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#5e8a8d] bg-[#eaedeb] border border-[#d8ddda] px-1.5 py-0.5 rounded-lg">
          <Lock className="w-2.5 h-2.5" /> Pro
        </span>
      )}
      {isActive && !hasLock && (
        <ChevronRight
          className="w-3 h-3 opacity-40"
          style={{ color: "#60b4af" }}
        />
      )}
    </Link>
  );
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const prevPathnameRef = useRef<string | null>(null);

  const isActive = useCallback(
    (href: string) => pathname === href || pathname.startsWith(href + "/"),
    [pathname],
  );
  const canAccessNavItem = useCallback(
    (item: NavItem) =>
      item.href !== "/app/integrations" ||
      user?.role === "SUPER_ADMIN" ||
      user?.role === "ADMIN",
    [user?.role],
  );

  useEffect(() => {
    NAV_SECTIONS.forEach((section) => {
      if (section.items.some((item) => canAccessNavItem(item) && isActive(item.href))) {
        setCollapsed((prev) => {
          const next = new Set(prev);
          next.delete(section.title);
          return next;
        });
      }
    });
  }, [pathname, isActive, canAccessNavItem]);

  useEffect(() => {
    if (
      prevPathnameRef.current !== null &&
      prevPathnameRef.current !== pathname
    ) {
      onClose();
    }
    prevPathnameRef.current = pathname;
  }, [pathname, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const toggleSection = (title: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[60] lg:hidden"
          style={{
            backgroundColor: "rgba(21, 31, 33, 0.35)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        data-gsap-shell="sidebar"
        className={`fixed left-0 top-0 bottom-0 w-[17rem] lg:w-[15.5rem] flex flex-col z-[70] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          backgroundColor: "#f5f7f6",
          borderRight: "1px solid rgba(21, 31, 33, 0.06)",
          boxShadow: isOpen
            ? "12px 0 48px rgba(21, 31, 33, 0.1)"
            : "1px 0 8px rgba(21, 31, 33, 0.03)",
        }}
      >
        {/* Logo header */}
        <div
          className="px-4 h-[3.75rem] flex items-center justify-between flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(21, 31, 33, 0.06)" }}
        >
          <Link href="/" className="flex items-center">
            <ClinicGrowerLogo variant="full" />
          </Link>
          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-2xl transition-all duration-200 active:scale-95"
            style={{
              color: "#5e8a8d",
              backgroundColor: "rgba(96, 180, 175, 0.06)",
              border: "1px solid rgba(96, 180, 175, 0.12)",
            }}
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation sections */}
        <nav
          data-gsap-nav
          className="flex-1 overflow-y-auto px-3 py-4 space-y-1 overscroll-contain"
        >
          {NAV_SECTIONS.map((section, idx) => {
            const isCollapsed = collapsed.has(section.title);
            const visibleItems = section.items.filter(canAccessNavItem);
            const hasActiveItem = visibleItems.some((item) =>
              isActive(item.href),
            );

            return (
              <div key={section.title} className={idx > 0 ? "mt-2" : ""}>
                <button
                  data-gsap-nav-item
                  onClick={() => toggleSection(section.title)}
                  className="w-full flex items-center justify-between px-3.5 py-1.5 mb-1 group rounded-xl hover:bg-[#eaedeb]/50 transition-colors duration-200"
                >
                  <span
                    className={`text-[10px] font-bold uppercase tracking-[0.12em] transition-colors duration-200 ${
                      hasActiveItem ? "text-[#60b4af]" : "text-[#A8A39B]"
                    }`}
                  >
                    {section.title}
                  </span>
                  {isCollapsed ? (
                    <ChevronRight className="w-3 h-3 text-[#d8ddda] group-hover:text-[#5e8a8d] transition-colors duration-200" />
                  ) : (
                    <ChevronDown className="w-3 h-3 text-[#d8ddda] group-hover:text-[#5e8a8d] transition-colors duration-200" />
                  )}
                </button>

                {!isCollapsed && (
                  <div className="space-y-0.5 animate-fade-in">
                    {visibleItems.map((item) => (
                      <NavItemLink
                        key={item.href}
                        item={item}
                        isActive={isActive(item.href)}
                      />
                    ))}
                  </div>
                )}

                {idx < NAV_SECTIONS.length - 1 && (
                  <div
                    className="mt-3"
                    style={{ borderBottom: "1px solid rgba(21, 31, 33, 0.06)" }}
                  />
                )}
              </div>
            );
          })}
        </nav>

        {/* Bottom nav */}
        <div
          className="px-3 py-3 flex-shrink-0"
          style={{ borderTop: "1px solid rgba(21, 31, 33, 0.06)" }}
        >
          {BOTTOM_NAV.map((item) => (
            <NavItemLink
              key={item.href}
              item={item}
              isActive={isActive(item.href)}
            />
          ))}
        </div>
      </aside>
    </>
  );
}
