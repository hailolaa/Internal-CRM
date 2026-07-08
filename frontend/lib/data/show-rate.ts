// ============================================================
// Show Rate / Missed Opportunity — data & types
// ============================================================

export interface Prediction {
  id: string;
  name: string;
  treatment: string;
  date: string;
  risk: number;
  factors: string[];
  action: string;
  reminderSent: boolean;
  depositRequested: boolean;
}

export const INITIAL_PREDICTIONS: Prediction[] = [
  {
    id: "p1",
    name: "Emma Wilson",
    treatment: "Lip Filler",
    date: "Tomorrow, 2pm",
    risk: 82,
    factors: ["First-time patient", "No deposit taken", "Booked 7+ days ago"],
    action: "Send SMS reminder + request deposit",
    reminderSent: false,
    depositRequested: false,
  },
  {
    id: "p2",
    name: "Charlotte Davis",
    treatment: "Botox",
    date: "Tomorrow, 4pm",
    risk: 45,
    factors: ["Returning patient", "No deposit taken"],
    action: "Send standard reminder",
    reminderSent: false,
    depositRequested: false,
  },
  {
    id: "p3",
    name: "Mia Roberts",
    treatment: "Dermal Filler",
    date: "Wed, 10am",
    risk: 71,
    factors: [
      "Rescheduled once before",
      "No deposit taken",
      "Long gap since last visit",
    ],
    action: "Call to confirm + request deposit",
    reminderSent: false,
    depositRequested: false,
  },
  {
    id: "p4",
    name: "Olivia Taylor",
    treatment: "Consultation",
    date: "Wed, 3pm",
    risk: 38,
    factors: ["Deposit paid", "Responded to reminder"],
    action: "No action needed",
    reminderSent: false,
    depositRequested: false,
  },
  {
    id: "p5",
    name: "Sophie Brown",
    treatment: "Skin Treatment",
    date: "Thu, 11am",
    risk: 15,
    factors: ["VIP patient", "Deposit paid", "Regular visitor"],
    action: "No action needed",
    reminderSent: false,
    depositRequested: false,
  },
];

export const SHOW_RATE_WEEKLY_STATS = [
  {
    label: "Predicted No-Shows",
    value: "4",
    sub: "This week",
    color: "red" as const,
  },
  {
    label: "Show Rate (Predicted)",
    value: "84%",
    sub: "vs 82% last week",
    color: "teal" as const,
  },
  {
    label: "Deposit Coverage",
    value: "62%",
    sub: "38% unprotected",
    color: "amber" as const,
  },
  {
    label: "Revenue at Risk",
    value: "£2,840",
    sub: "From predicted no-shows",
    color: "rose" as const,
  },
] as const;

export const DEPOSIT_POLICIES = [
  {
    treatment: "Botox Appointments",
    detail:
      "Current show rate: 91%. No deposit needed — conversion impact outweighs risk.",
    color: "#5A8A6A",
    bg: "rgba(90, 138, 106, 0.05)",
    border: "rgba(90, 138, 106, 0.2)",
  },
  {
    treatment: "Filler Appointments",
    detail:
      "Current show rate: 74%. Recommend £50 deposit — predicted to improve to 92%.",
    color: "#A07840",
    bg: "rgba(160, 120, 64, 0.05)",
    border: "rgba(160, 120, 64, 0.2)",
  },
  {
    treatment: "Consultations",
    detail:
      "Current show rate: 68%. Recommend £25 deposit — predicted to improve to 88%.",
    color: "#8A4A4A",
    bg: "rgba(138, 74, 74, 0.05)",
    border: "rgba(138, 74, 74, 0.2)",
  },
] as const;

export function getRiskStyles(risk: number) {
  if (risk >= 70)
    return {
      bg: "rgba(138, 74, 74, 0.08)",
      text: "#8A4A4A",
      border: "rgba(138, 74, 74, 0.2)",
      btnBg: "rgba(138, 74, 74, 0.08)",
      btnText: "#8A4A4A",
      btnBorder: "rgba(138, 74, 74, 0.2)",
      btnLabel: "Send Reminder",
    };
  if (risk >= 40)
    return {
      bg: "rgba(160, 120, 64, 0.08)",
      text: "#A07840",
      border: "rgba(160, 120, 64, 0.2)",
      btnBg: "rgba(160, 120, 64, 0.08)",
      btnText: "#A07840",
      btnBorder: "rgba(160, 120, 64, 0.2)",
      btnLabel: "Nudge",
    };
  return {
    bg: "rgba(90, 138, 106, 0.08)",
    text: "#5A8A6A",
    border: "rgba(90, 138, 106, 0.2)",
    btnBg: "",
    btnText: "",
    btnBorder: "",
    btnLabel: "",
  };
}
