export const SALES_LOSS_REASON_OPTIONS = [
  { value: "no_response", label: "No response" },
  { value: "budget", label: "Budget" },
  { value: "timing", label: "Timing" },
  { value: "competitor", label: "Competitor" },
  { value: "in_house", label: "In-house" },
  { value: "poor_fit", label: "Poor fit" },
  { value: "other", label: "Other" },
] as const;

export const SALES_OBJECTION_TYPE_OPTIONS = SALES_LOSS_REASON_OPTIONS;

export function salesOutcomeLabel(value?: string | null) {
  return SALES_LOSS_REASON_OPTIONS.find((option) => option.value === value)?.label || value || "Not set";
}
