"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

export interface SubNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export function SubNav({
  items,
  className = "",
}: {
  items: SubNavItem[];
  className?: string;
}) {
  const pathname = usePathname();

  const sectionRoots = items.map((item) => {
    const parts = item.href.split("/");
    return parts.slice(0, -1).join("/");
  });
  const uniqueRoots = sectionRoots.filter(
    (root, index) => sectionRoots.indexOf(root) === index,
  );

  const isInSection = uniqueRoots.some((root) => pathname.startsWith(root));

  if (!isInSection) return null;

  return (
    <div
      className={`-mx-3.5 sm:-mx-5 md:-mx-6 lg:-mx-8 px-3.5 sm:px-5 md:px-6 lg:px-8 mb-5 md:mb-7 ${className}`}
      style={{
        borderBottom: "1px solid #d8ddda",
        backgroundColor: "rgba(255, 252, 249, 0.97)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
    >
      <div
        className="flex gap-0 overflow-x-auto -mb-px scrollbar-hide"
        style={{
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {items.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-3 sm:py-3.5 text-xs sm:text-sm whitespace-nowrap transition-all duration-200 flex-shrink-0 font-medium group"
              style={{
                color: isActive ? "#151f21" : "#5e8a8d",
              }}
            >
              <Icon
                className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 transition-colors"
                style={{ color: isActive ? "#60b4af" : "#A8A39B" }}
              />
              <span>{item.label}</span>
              {/* Active indicator line */}
              {isActive && (
                <span
                  className="absolute bottom-0 left-2.5 right-2.5 sm:left-3 sm:right-3 h-[2.5px] rounded-t-full"
                  style={{ backgroundColor: "#60b4af" }}
                />
              )}
              {/* Hover indicator */}
              {!isActive && (
                <span
                  className="absolute bottom-0 left-2.5 right-2.5 sm:left-3 sm:right-3 h-[2px] rounded-t-full opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ backgroundColor: "#d8ddda" }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
