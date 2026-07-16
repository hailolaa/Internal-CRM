"use client";

import Link from "next/link";
import type { KeyboardEvent, ReactNode } from "react";
import { getDashboardKeyboardTargetIndex } from "@/lib/dashboard-cards";

export function DashboardKpiCardLink({
  href,
  ariaLabel,
  index,
  activeIndex,
  setActiveIndex,
  registerItemRef,
  totalItems,
  children,
}: {
  href: string;
  ariaLabel: string;
  index: number;
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  registerItemRef: (index: number, node: HTMLAnchorElement | null) => void;
  totalItems: number;
  children?: ReactNode;
}) {
  const handleKeyDown = (event: KeyboardEvent<HTMLAnchorElement>) => {
    const isWide = window.matchMedia("(min-width: 1280px)").matches;
    const isTablet = window.matchMedia("(min-width: 640px)").matches;
    const columnCount = isWide ? 6 : isTablet ? 2 : 1;
    const targetIndex = getDashboardKeyboardTargetIndex({
      currentIndex: index,
      key: event.key,
      totalItems,
      columnCount,
    });

    if (targetIndex !== index || event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setActiveIndex(targetIndex);
      event.currentTarget
        .closest("[data-dashboard-kpi-grid]")
        ?.querySelectorAll<HTMLAnchorElement>("[data-dashboard-kpi-card]")
        [targetIndex]?.focus();
    }
  };

  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      ref={(node) => registerItemRef(index, node)}
      data-dashboard-kpi-card
      tabIndex={activeIndex === index ? 0 : -1}
      onFocus={() => setActiveIndex(index)}
      onKeyDown={handleKeyDown}
      className="group block rounded-[24px] transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#315f62] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAF8F5] [&_[data-gsap-metric]]:h-full [&_[data-gsap-metric]]:transition-all [&_[data-gsap-metric]]:group-hover:border-[rgba(96,180,175,0.24)] [&_[data-gsap-metric]]:group-hover:shadow-[0_8px_24px_rgba(21,31,33,0.08)]"
    >
      {children}
    </Link>
  );
}
