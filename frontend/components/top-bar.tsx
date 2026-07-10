"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Bell, User, Settings, LogOut, Search } from "lucide-react";
import { PAGE_TITLES } from "@/lib/constants";
import { TenantSwitcher, TenantBadge } from "@/components/tenant-switcher";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import ClinicGrowerLogo from "@/components/brand/ClinicGrowerLogo";

interface TopBarProps {
  onMenuClick: () => void;
  onCommandPaletteOpen: () => void;
}

const NOTIFICATIONS = [
  { id: 1, text: "New prospect enquiry received", time: "2 min ago" },
  { id: 2, text: "Proposal follow-up due", time: "18 min ago" },
  { id: 3, text: "Client task deadline approaching", time: "1 hour ago" },
];

export default function TopBar({
  onMenuClick,
  onCommandPaletteOpen,
}: TopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const initials =
    user?.avatar ||
    user?.name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ||
    "CG";

  const getTitle = (): string => {
    const sortedEntries = Object.entries(PAGE_TITLES).sort(
      ([a], [b]) => b.length - a.length,
    );
    for (const [path, title] of sortedEntries) {
      if (pathname === path || pathname.startsWith(path + "/")) return title;
    }
    return "Mission Control";
  };

  return (
    <header
      data-gsap-shell="topbar"
      className="h-14 md:h-[3.25rem] flex items-center justify-between px-3.5 sm:px-4 md:px-6 sticky top-0 z-40"
      style={{
        backgroundColor: "rgba(245, 247, 246, 0.92)",
        borderBottom: "1px solid rgba(21, 31, 33, 0.06)",
        backdropFilter: "blur(20px) saturate(160%)",
        WebkitBackdropFilter: "blur(20px) saturate(160%)",
        boxShadow: "0 1px 8px rgba(21, 31, 33, 0.04)",
      }}
    >
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        {/* Mobile: hamburger */}
        <button
          type="button"
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-0.5 rounded-2xl transition-all duration-200 active:scale-95 flex-shrink-0"
          style={{
            color: "#151f21",
            backgroundColor: "rgba(96, 180, 175, 0.06)",
            border: "1px solid rgba(96, 180, 175, 0.12)",
          }}
          aria-label="Open navigation menu"
        >
          <Menu className="w-[18px] h-[18px]" />
        </button>

        {/* Mobile: logo */}
        <Link href="/" className="lg:hidden flex items-center min-w-0">
          <ClinicGrowerLogo variant="full" />
        </Link>

        {/* Desktop: page title */}
        <h1
          className="text-sm font-semibold tracking-tight hidden lg:block"
          style={{ color: "#151f21", letterSpacing: "-0.01em" }}
        >
          {getTitle()}
        </h1>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 flex-shrink-0">
        <button
          type="button"
          onClick={onCommandPaletteOpen}
          className="flex items-center gap-2 rounded-2xl border border-[#d8ddda] px-2.5 py-2 text-sm font-medium text-[#5e8a8d] transition-colors hover:bg-[#eaedeb] sm:px-3"
          aria-label="Open command palette"
        >
          <Search className="h-4 w-4 flex-shrink-0" />
          <span className="hidden lg:inline">Search</span>
          <kbd className="hidden rounded-md border border-[#d8ddda] px-1.5 py-0.5 text-[10px] font-semibold text-[#A8A39B] xl:inline">
            Ctrl K
          </kbd>
        </button>

        {/* Mobile: notification bell */}
        <div className="lg:hidden relative flex-shrink-0">
          <button
            type="button"
            onClick={() => {
              setNotificationsOpen((prev) => !prev);
              setProfileMenuOpen(false);
            }}
            className="p-2 rounded-2xl transition-all duration-200 relative hover:bg-[#eaedeb] active:scale-95"
            style={{ color: "#5e8a8d" }}
            aria-label="Notifications"
          >
            <Bell className="w-[18px] h-[18px]" />
            <span
              className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
              style={{ backgroundColor: "#60b4af" }}
            />
          </button>

          {/* Notifications dropdown */}
          {notificationsOpen && (
            <div
              data-gsap-popover
              className="absolute right-0 top-full mt-2 w-72 z-50"
              style={{
                background: "#FFFCF9",
                border: "1px solid rgba(21,31,33,0.07)",
                borderRadius: 18,
                boxShadow: "0 8px 32px rgba(21,31,33,0.10)",
              }}
            >
              <div
                className="px-4 py-3"
                style={{ borderBottom: "1px solid rgba(21,31,33,0.06)" }}
              >
                <span
                  className="text-xs font-semibold"
                  style={{
                    color: "#5e8a8d",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}
                >
                  Notifications
                </span>
              </div>
              <ul className="py-2">
                {NOTIFICATIONS.map((n) => (
                  <li
                    key={n.id}
                    data-gsap-list-item
                    className="flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer"
                    style={{ borderBottom: "1px solid rgba(21,31,33,0.04)" }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background =
                        "rgba(96,180,175,0.05)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    <span
                      className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: "#60b4af" }}
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-medium"
                        style={{ color: "#151f21" }}
                      >
                        {n.text}
                      </p>
                      <p
                        className="text-xs mt-0.5"
                        style={{ color: "#5e8a8d" }}
                      >
                        {n.time}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="px-4 py-3">
                <button
                  type="button"
                  className="text-xs font-semibold w-full text-center transition-colors"
                  style={{ color: "#60b4af" }}
                  onClick={() => setNotificationsOpen(false)}
                >
                  Mark all as read
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="hidden md:block">
          <TenantSwitcher />
        </div>
        <div className="hidden lg:block">
          <TenantBadge />
        </div>

        {/* Phase indicator */}
        <div
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-2xl"
          style={{
            backgroundColor: "rgba(96, 180, 175, 0.06)",
            border: "1px solid rgba(96, 180, 175, 0.12)",
          }}
        >
          <div
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: "#60b4af" }}
          />
          <span
            className="text-[11px] font-semibold"
            style={{ color: "#60b4af" }}
          >
            Mission Control
          </span>
        </div>

        {/* Avatar + profile dropdown */}
        <div className="relative flex-shrink-0">
          <button
            type="button"
            aria-label="Open user menu"
            onClick={() => {
              setProfileMenuOpen((prev) => !prev);
              setNotificationsOpen(false);
            }}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold transition-transform duration-200 hover:scale-105 active:scale-95"
            style={{
              background: "linear-gradient(135deg, #60b4af 0%, #7eccc7 100%)",
              boxShadow: "0 2px 10px rgba(96, 180, 175, 0.25)",
            }}
          >
            {initials}
          </button>

          {/* Profile dropdown */}
          {profileMenuOpen && (
            <div
              data-gsap-popover
              className="absolute right-0 top-full mt-2 w-48 z-50"
              style={{
                background: "#FFFCF9",
                border: "1px solid rgba(21,31,33,0.06)",
                borderRadius: 18,
                boxShadow: "0 8px 32px rgba(21,31,33,0.10)",
              }}
            >
              <div
                className="px-4 py-3"
                style={{ borderBottom: "1px solid rgba(21,31,33,0.06)" }}
              >
                <p
                  className="text-sm font-semibold"
                  style={{ color: "#151f21" }}
                >
                  {user?.name || "The Growth Group team member"}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "#5e8a8d" }}>
                  {user?.email || "Signed in"}
                </p>
              </div>
              <ul className="py-2">
                <li>
                  <Link
                    href="/app/settings"
                    data-gsap-list-item
                    onClick={() => setProfileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                    style={{ color: "#151f21" }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background =
                        "rgba(96,180,175,0.06)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    <User
                      className="w-4 h-4 flex-shrink-0"
                      style={{ color: "#5e8a8d" }}
                    />
                    Profile
                  </Link>
                </li>
                <li>
                  <Link
                    href="/app/settings"
                    data-gsap-list-item
                    onClick={() => setProfileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                    style={{ color: "#151f21" }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background =
                        "rgba(96,180,175,0.06)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    <Settings
                      className="w-4 h-4 flex-shrink-0"
                      style={{ color: "#5e8a8d" }}
                    />
                    Settings
                  </Link>
                </li>
                <li
                  style={{
                    borderTop: "1px solid rgba(21,31,33,0.06)",
                    marginTop: 4,
                    paddingTop: 4,
                  }}
                >
                  <button
                    type="button"
                    data-gsap-list-item
                    className="flex items-center gap-3 px-4 py-2.5 text-sm w-full text-left transition-colors"
                    style={{ color: "#151f21" }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background =
                        "rgba(154,85,36,0.06)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                    onClick={() => {
                      setProfileMenuOpen(false);
                      logout();
                      router.replace("/login");
                    }}
                  >
                    <LogOut
                      className="w-4 h-4 flex-shrink-0"
                      style={{ color: "#5e8a8d" }}
                    />
                    Sign out
                  </button>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
