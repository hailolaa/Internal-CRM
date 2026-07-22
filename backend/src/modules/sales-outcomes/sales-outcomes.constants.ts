export const salesLossReasons = [
  "no_response",
  "budget",
  "timing",
  "competitor",
  "in_house",
  "poor_fit",
  "other",
] as const;

export const salesObjectionTypes = [
  "no_response",
  "budget",
  "timing",
  "competitor",
  "in_house",
  "poor_fit",
  "other",
] as const;

export type SalesLossReason = typeof salesLossReasons[number];
export type SalesObjectionType = typeof salesObjectionTypes[number];
