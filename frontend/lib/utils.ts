// ============================================================
// Utility functions — pure, testable helpers
// ============================================================

/**
 * Merge class names, filtering out falsy values.
 */
export function cn(...inputs: (string | undefined | null | false)[]): string {
  return inputs.filter(Boolean).join(" ");
}

/**
 * Format a number as GBP currency string.
 */
export function formatCurrency(value: number, decimals = 0): string {
  return `£${value.toLocaleString("en-GB", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

/**
 * Format a number with locale separators.
 */
export function formatNumber(value: number): string {
  return value.toLocaleString("en-GB");
}

/**
 * Calculate percentage, clamped 0-100.
 */
export function percentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.min(Math.round((value / total) * 100), 100);
}

/**
 * Get initials from a name string (max 2 chars).
 */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Pluralise a word based on count.
 */
export function pluralise(
  count: number,
  singular: string,
  plural?: string,
): string {
  return count === 1 ? singular : plural || `${singular}s`;
}

/**
 * Truncate text to a max length with ellipsis.
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}…`;
}

/**
 * Parse a currency string like "£1,234" to a number.
 */
export function parseCurrency(value: string): number {
  return parseInt(value.replace(/[£,]/g, "") || "0", 10);
}

/**
 * Mask a string, showing first/last N characters.
 */
export function maskString(
  value: string,
  showFirst = 12,
  showLast = 4,
  maskChar = "•",
): string {
  if (value.length <= showFirst + showLast) return value;
  const masked = maskChar.repeat(
    Math.min(12, value.length - showFirst - showLast),
  );
  return value.slice(0, showFirst) + masked + value.slice(-showLast);
}

/**
 * Generate a deterministic gradient class from a string (for avatars).
 */
const AVATAR_GRADIENTS = [
  "from-teal-400 to-cyan-500",
  "from-violet-400 to-purple-500",
  "from-rose-400 to-pink-500",
  "from-amber-400 to-orange-500",
  "from-blue-400 to-indigo-500",
  "from-emerald-400 to-green-500",
];

export function getAvatarGradient(name: string): string {
  const hash = name
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

/**
 * Noop function — use as default callback.
 */
export function noop(): void {}
