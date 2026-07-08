// ============================================================
// Retention — data
// ============================================================

export const REBOOKING_QUEUE = [
  {
    name: "Laura Bennett",
    lastTreatment: "Botox",
    lastDate: "12 Jan 2026",
    dueDate: "12 Apr 2026",
    status: "Due Soon" as const,
    sms: true,
    email: true,
  },
  {
    name: "Rachel Green",
    lastTreatment: "Dermal Filler",
    lastDate: "28 Dec 2025",
    dueDate: "28 Mar 2026",
    status: "Due Soon" as const,
    sms: true,
    email: false,
  },
  {
    name: "Kate Morgan",
    lastTreatment: "Chemical Peel",
    lastDate: "15 Nov 2025",
    dueDate: "15 Feb 2026",
    status: "Overdue" as const,
    sms: false,
    email: true,
  },
  {
    name: "Sarah Palmer",
    lastTreatment: "Lip Filler",
    lastDate: "20 Oct 2025",
    dueDate: "20 Jan 2026",
    status: "Overdue" as const,
    sms: true,
    email: true,
  },
] as const;

export const LAPSED_PATIENTS = [
  {
    name: "Diana Ross",
    lastVisit: "14 Aug 2025",
    treatments: 3,
    totalSpend: "£2,400",
    daysSince: 194,
  },
  {
    name: "Michelle Carter",
    lastVisit: "02 Jul 2025",
    treatments: 5,
    totalSpend: "£4,100",
    daysSince: 237,
  },
  {
    name: "Amanda Price",
    lastVisit: "18 Jun 2025",
    treatments: 2,
    totalSpend: "£1,200",
    daysSince: 251,
  },
] as const;
