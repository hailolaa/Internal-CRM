export const consultOutcomes = [
  "Sold",
  "Not Sold",
  "Treatment Booked",
  "Thinking",
  "Finance",
  "Not Suitable",
  "Declined",
  "No-show",
  "No Show",
  "Attended",
] as const;

export const defaultConsultOutcomeOptions = [
  { value: "Sold", label: "Sold" },
  { value: "Not Sold", label: "Not sold" },
  { value: "Thinking", label: "Thinking" },
  { value: "Finance", label: "Finance" },
  { value: "Not Suitable", label: "Not suitable" },
  { value: "No-show", label: "No-show" },
  { value: "Attended", label: "Attended" },
] as const;

export function normalizeConsultOutcome(value: string | null | undefined) {
  if (!value) return value;
  const normalized = value.trim().toLowerCase();
  if (normalized === "treatment booked") return "Sold";
  if (normalized === "declined") return "Not Sold";
  if (normalized === "no show") return "No-show";
  if (normalized === "not suitable") return "Not Suitable";
  return value;
}

export const consultDepositStatuses = [
  "not_required",
  "requested",
  "paid",
  "waived",
  "refunded",
] as const;
