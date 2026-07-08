"use client";

import { PhaseBadge } from "./badges";

// ============================================================
// PageHeader — consistent page header with icon + title
// ============================================================
export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  iconColor = "text-[#60b4af]",
  iconBg = "",
  right,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  iconColor?: string;
  iconBg?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        {Icon && (
          <div
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{
              backgroundColor: "rgba(96, 180, 175, 0.08)",
              border: "1px solid rgba(96, 180, 175, 0.12)",
            }}
          >
            <Icon className={`w-5 h-5 sm:w-5 sm:h-5 ${iconColor}`} />
          </div>
        )}
        <div className="min-w-0">
          <h1
            className="text-xl sm:text-2xl md:text-[1.75rem] font-bold truncate"
            style={{ color: "#151f21", letterSpacing: "-0.03em" }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              className="text-xs sm:text-[13px] mt-0.5 line-clamp-1"
              style={{ color: "#5e8a8d" }}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {right && <div className="flex-shrink-0">{right}</div>}
    </div>
  );
}

// ============================================================
// EmptyState — placeholder for empty content
// ============================================================
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className="p-8 sm:p-10 md:p-14"
      style={{
        backgroundColor: "#FFFCF9",
        border: "1px solid rgba(21,31,33,0.06)",
        borderRadius: "24px",
        boxShadow: "0 1px 6px rgba(21,31,33,0.03)",
      }}
    >
      <div className="text-center">
        {Icon && (
          <div
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 sm:mb-6"
            style={{
              backgroundColor: "#eaedeb",
              border: "1px solid rgba(21,31,33,0.06)",
            }}
          >
            <Icon className="w-7 h-7 sm:w-8 sm:h-8 text-[#5e8a8d]" />
          </div>
        )}
        <h2
          className="text-base sm:text-lg md:text-xl font-semibold mb-2 tracking-tight"
          style={{ color: "#151f21" }}
        >
          {title}
        </h2>
        {description && (
          <p
            className="max-w-md mx-auto leading-relaxed text-xs sm:text-sm"
            style={{ color: "#5e8a8d" }}
          >
            {description}
          </p>
        )}
        {action && <div className="mt-6 sm:mt-7">{action}</div>}
      </div>
    </div>
  );
}

// ============================================================
// FeatureGatePage — "Coming Soon" locked module page
// ============================================================
export function FeatureGatePage({
  title,
  icon: Icon,
  phase,
  description,
  features,
  ctaLabel,
  accentColor = "purple",
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  phase: string;
  description: string;
  features: {
    name: string;
    desc: string;
    icon: React.ComponentType<{ className?: string }>;
  }[];
  ctaLabel: string;
  accentColor?: "purple" | "amber";
}) {
  const iconBg = "rgba(96, 180, 175, 0.08)";
  const iconBorder = "rgba(96, 180, 175, 0.12)";
  const iconTextClass = "text-[#60b4af]";
  const btnBg = "#60b4af";

  return (
    <div className="max-w-3xl mx-auto py-8 sm:py-10 md:py-14 text-center px-1">
      <div
        className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
        style={{ backgroundColor: iconBg, border: `1px solid ${iconBorder}` }}
      >
        <Icon className={`w-7 h-7 sm:w-8 sm:h-8 ${iconTextClass}`} />
      </div>
      <h1
        className="text-xl sm:text-2xl md:text-[1.75rem] font-bold mb-2 tracking-tight"
        style={{ color: "#151f21" }}
      >
        {title}
      </h1>
      <PhaseBadge phase={phase} color={accentColor} />
      <p
        className="text-xs sm:text-sm mb-8 mt-5 max-w-md mx-auto leading-relaxed"
        style={{ color: "#5e8a8d" }}
      >
        {description}
      </p>

      <div
        className="p-5 sm:p-6 md:p-8 text-left mb-8"
        style={{
          backgroundColor: "#FFFCF9",
          border: "1px solid rgba(21,31,33,0.06)",
          borderRadius: "24px",
          boxShadow: "0 1px 6px rgba(21,31,33,0.03)",
        }}
      >
        <h3 className="text-sm font-semibold mb-5" style={{ color: "#151f21" }}>
          What&apos;s included
        </h3>
        <div className="space-y-4 sm:space-y-5">
          {features.map((f) => (
            <div key={f.name} className="flex items-start gap-3 sm:gap-4">
              <div
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ backgroundColor: iconBg }}
              >
                <f.icon className={`w-4 h-4 ${iconTextClass}`} />
              </div>
              <div>
                <div
                  className="text-xs sm:text-sm font-semibold tracking-tight"
                  style={{ color: "#151f21" }}
                >
                  {f.name}
                </div>
                <div
                  className="text-[11px] sm:text-xs mt-0.5"
                  style={{ color: "#5e8a8d" }}
                >
                  {f.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        disabled
        aria-disabled="true"
        title="This module is not available yet."
        className="px-6 sm:px-7 py-3 text-white text-sm font-semibold rounded-2xl opacity-70 cursor-not-allowed"
        style={{
          backgroundColor: btnBg,
          boxShadow: "0 4px 16px rgba(96, 180, 175, 0.3)",
        }}
      >
        {ctaLabel}
      </button>
    </div>
  );
}

// ============================================================
// AlertBanner — contextual alert/notification banner
// ============================================================
export function AlertBanner({
  icon: Icon,
  title,
  description,
  variant = "warning",
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  variant?: "warning" | "error" | "success" | "info";
  action?: React.ReactNode;
}) {
  const styles = {
    warning: {
      bg: "rgba(183, 103, 46, 0.06)",
      border: "rgba(183, 103, 46, 0.15)",
      iconClass: "text-[#b7672e]",
    },
    error: {
      bg: "rgba(154, 85, 36, 0.06)",
      border: "rgba(154, 85, 36, 0.15)",
      iconClass: "text-[#9a5524]",
    },
    success: {
      bg: "rgba(96, 180, 175, 0.06)",
      border: "rgba(96, 180, 175, 0.15)",
      iconClass: "text-[#60b4af]",
    },
    info: {
      bg: "rgba(94, 138, 141, 0.06)",
      border: "rgba(94, 138, 141, 0.12)",
      iconClass: "text-[#5e8a8d]",
    },
  };

  const s = styles[variant];

  return (
    <div
      className="rounded-2xl p-4 sm:p-4.5 flex items-start gap-3"
      style={{ backgroundColor: s.bg, border: `1px solid ${s.border}` }}
    >
      {Icon && (
        <Icon className={`w-4 h-4 ${s.iconClass} flex-shrink-0 mt-0.5`} />
      )}
      <div className="flex-1 min-w-0">
        <p className={`text-xs sm:text-sm font-semibold ${s.iconClass}`}>
          {title}
        </p>
        {description && (
          <p
            className="text-[11px] sm:text-xs mt-1 leading-relaxed"
            style={{ color: "#5e8a8d" }}
          >
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

// ============================================================
// ProgressBar — horizontal progress indicator
// ============================================================
export function ProgressBar({
  value,
  max = 100,
  color = "sage",
  height = "h-1.5",
  showLabel = false,
}: {
  value: number;
  max?: number;
  color?: string;
  height?: string;
  showLabel?: boolean;
}) {
  const pct = Math.min(Math.round((value / max) * 100), 100);
  const colorMap: Record<string, string> = {
    sage: "#60b4af",
    violet: "#60b4af",
    indigo: "#60b4af",
    teal: "#5e8a8d",
    blue: "#5e8a8d",
    green: "#60b4af",
    amber: "#b7672e",
    red: "#9a5524",
  };

  const bgColor = colorMap[color] || colorMap.sage;

  return (
    <div>
      {showLabel && (
        <div
          className="flex justify-between text-xs mb-1.5"
          style={{ color: "#5e8a8d" }}
        >
          <span>{value}</span>
          <span>{pct}%</span>
        </div>
      )}
      <div
        className={`${height} rounded-full overflow-hidden`}
        style={{ backgroundColor: "rgba(21,31,33,0.06)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: bgColor }}
        />
      </div>
    </div>
  );
}

// ============================================================
// Avatar — user/contact avatar
// ============================================================
export function Avatar({
  name,
  size = "md",
  src,
  className = "",
}: {
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  src?: string;
  className?: string;
}) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);

  const sizeMap = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-14 h-14 text-base",
    xl: "w-20 h-20 text-lg",
  };

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${sizeMap[size]} rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeMap[size]} rounded-full flex items-center justify-center font-semibold flex-shrink-0 text-white ${className}`}
      style={{ background: "linear-gradient(135deg, #60b4af, #7eccc7)" }}
    >
      {initials}
    </div>
  );
}

// ============================================================
// ActionButton — primary action button
// ============================================================
export function ActionButton({
  children,
  onClick,
  icon: Icon,
  variant = "primary",
  disabled = false,
  className = "",
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  icon?: React.ComponentType<{ className?: string }>;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
}) {
  const variantClasses = {
    primary: "text-white hover:opacity-90",
    secondary:
      "text-[#4B5563] border border-[rgba(21,31,33,0.08)] hover:bg-[#eaedeb]",
    ghost: "text-[#5e8a8d] hover:bg-[#eaedeb] hover:text-[#151f21]",
    danger: "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100",
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      backgroundColor: "#60b4af",
      boxShadow: "0 2px 8px rgba(96,180,175,0.25)",
    },
    secondary: { backgroundColor: "#FFFCF9" },
    ghost: {},
    danger: {},
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2.5 rounded-2xl flex items-center gap-2 transition-all duration-200 font-medium text-sm disabled:opacity-50 ${variantClasses[variant]} ${className}`}
      style={variantStyles[variant]}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </button>
  );
}
