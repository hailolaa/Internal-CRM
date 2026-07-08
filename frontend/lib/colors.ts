// ============================================================
// Color utility maps — single source of truth for accent colors
// ============================================================

export const accentColors = {
  teal: {
    text: "text-teal-400",
    bg: "bg-teal-500/10",
    border: "border-teal-500/30",
    gradient: "from-teal-500/20 to-cyan-500/20",
    solid: "bg-teal-500",
    hover: "hover:bg-teal-500/20",
  },
  blue: {
    text: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    gradient: "from-blue-500/20 to-cyan-500/20",
    solid: "bg-blue-500",
    hover: "hover:bg-blue-500/20",
  },
  violet: {
    text: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/30",
    gradient: "from-violet-500/20 to-purple-500/20",
    solid: "bg-violet-500",
    hover: "hover:bg-violet-500/20",
  },
  rose: {
    text: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/30",
    gradient: "from-rose-500/20 to-pink-500/20",
    solid: "bg-rose-500",
    hover: "hover:bg-rose-500/20",
  },
  amber: {
    text: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    gradient: "from-amber-500/20 to-orange-500/20",
    solid: "bg-amber-500",
    hover: "hover:bg-amber-500/20",
  },
  green: {
    text: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/30",
    gradient: "from-green-500/20 to-emerald-500/20",
    solid: "bg-green-500",
    hover: "hover:bg-green-500/20",
  },
  red: {
    text: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    gradient: "from-red-500/20 to-rose-500/20",
    solid: "bg-red-500",
    hover: "hover:bg-red-500/20",
  },
  emerald: {
    text: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    gradient: "from-emerald-500/20 to-teal-500/20",
    solid: "bg-emerald-500",
    hover: "hover:bg-emerald-500/20",
  },
  indigo: {
    text: "text-indigo-400",
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/30",
    gradient: "from-indigo-500/20 to-violet-500/20",
    solid: "bg-indigo-500",
    hover: "hover:bg-indigo-500/20",
  },
  pink: {
    text: "text-pink-400",
    bg: "bg-pink-500/10",
    border: "border-pink-500/30",
    gradient: "from-pink-500/20 to-rose-500/20",
    solid: "bg-pink-500",
    hover: "hover:bg-pink-500/20",
  },
  fuchsia: {
    text: "text-fuchsia-400",
    bg: "bg-fuchsia-500/10",
    border: "border-fuchsia-500/30",
    gradient: "from-fuchsia-500/20 to-pink-500/20",
    solid: "bg-fuchsia-500",
    hover: "hover:bg-fuchsia-500/20",
  },
  sky: {
    text: "text-sky-400",
    bg: "bg-sky-500/10",
    border: "border-sky-500/30",
    gradient: "from-sky-500/20 to-blue-500/20",
    solid: "bg-sky-500",
    hover: "hover:bg-sky-500/20",
  },
  purple: {
    text: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
    gradient: "from-purple-500/20 to-indigo-500/20",
    solid: "bg-purple-500",
    hover: "hover:bg-purple-500/20",
  },
  cyan: {
    text: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/30",
    gradient: "from-cyan-500/20 to-teal-500/20",
    solid: "bg-cyan-500",
    hover: "hover:bg-cyan-500/20",
  },
  orange: {
    text: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
    gradient: "from-orange-500/20 to-amber-500/20",
    solid: "bg-orange-500",
    hover: "hover:bg-orange-500/20",
  },
} as const;

export type AccentKey = keyof typeof accentColors;

export function getAccent(color: AccentKey) {
  return accentColors[color];
}

// Status variant to color mapping
export const statusColors = {
  success: {
    bg: "bg-green-500/10",
    text: "text-green-400",
    border: "border-green-500/20",
  },
  warning: {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/20",
  },
  error: {
    bg: "bg-red-500/10",
    text: "text-red-400",
    border: "border-red-500/20",
  },
  info: {
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    border: "border-blue-500/20",
  },
  neutral: {
    bg: "bg-gray-500/10",
    text: "text-gray-400",
    border: "border-gray-500/20",
  },
  premium: {
    bg: "bg-purple-500/10",
    text: "text-purple-400",
    border: "border-purple-500/20",
  },
} as const;

export function getStatusColor(variant: keyof typeof statusColors) {
  return statusColors[variant];
}
