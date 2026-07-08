export const callCommercialOutcomes = [
  "booked_consult",
  "asked_for_prices",
  "not_suitable",
  "missed_no_answer",
  "follow_up_required",
  "existing_patient",
  "spam",
  "lost",
] as const;

export const defaultCallOutcomeOptions = [
  { value: "booked_consult", label: "Booked consult" },
  { value: "asked_for_prices", label: "Asked for prices" },
  { value: "not_suitable", label: "Not suitable" },
  { value: "missed_no_answer", label: "No answer / missed" },
  { value: "follow_up_required", label: "Follow-up required" },
  { value: "existing_patient", label: "Existing patient" },
  { value: "spam", label: "Spam" },
  { value: "lost", label: "Lost" },
] as const;
