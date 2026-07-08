// ============================================================
// Deposits — data & types
// ============================================================

export interface DepositRecord {
  id: string;
  contact: string;
  treatment: string;
  appointmentDate: string;
  depositAmount: number;
  depositPaid: boolean;
  paidDate: string | null;
  method: string | null;
  showedUp: boolean | null;
  practitioner: string;
  status: "requested" | "paid" | "failed" | "unpaid" | "waived" | "refunded";
  reminderSent: boolean;
  depositRequested: boolean;
}

export const INITIAL_DEPOSITS: DepositRecord[] = [
  {
    id: "dp1",
    contact: "Sarah Johnson",
    treatment: "Botox Full Face",
    appointmentDate: "12 May 2026",
    depositAmount: 50,
    depositPaid: true,
    paidDate: "5 May 2026",
    method: "Card",
    showedUp: null,
    practitioner: "Dr. Sarah Smith",
    status: "paid",
    reminderSent: false,
    depositRequested: false,
  },
  {
    id: "dp2",
    contact: "Emma Wilson",
    treatment: "Lip Filler 1ml",
    appointmentDate: "14 May 2026",
    depositAmount: 75,
    depositPaid: true,
    paidDate: "3 May 2026",
    method: "Card",
    showedUp: null,
    practitioner: "Dr. Sarah Smith",
    status: "paid",
    reminderSent: false,
    depositRequested: false,
  },
  {
    id: "dp3",
    contact: "Sophie Brown",
    treatment: "Dermal Filler",
    appointmentDate: "10 May 2026",
    depositAmount: 75,
    depositPaid: false,
    paidDate: null,
    method: null,
    showedUp: null,
    practitioner: "Dr. James Park",
    status: "unpaid",
    reminderSent: false,
    depositRequested: false,
  },
  {
    id: "dp4",
    contact: "Charlotte Davis",
    treatment: "Consultation",
    appointmentDate: "9 May 2026",
    depositAmount: 25,
    depositPaid: false,
    paidDate: null,
    method: null,
    showedUp: null,
    practitioner: "Dr. Emily Chen",
    status: "unpaid",
    reminderSent: false,
    depositRequested: false,
  },
  {
    id: "dp5",
    contact: "Olivia Taylor",
    treatment: "Botox Forehead",
    appointmentDate: "8 May 2026",
    depositAmount: 0,
    depositPaid: false,
    paidDate: null,
    method: null,
    showedUp: true,
    practitioner: "Dr. Sarah Smith",
    status: "waived",
    reminderSent: false,
    depositRequested: false,
  },
  {
    id: "dp6",
    contact: "Amelia Roberts",
    treatment: "Lip Filler 1ml",
    appointmentDate: "6 May 2026",
    depositAmount: 75,
    depositPaid: true,
    paidDate: "1 May 2026",
    method: "Card",
    showedUp: true,
    practitioner: "Dr. Sarah Smith",
    status: "paid",
    reminderSent: false,
    depositRequested: false,
  },
  {
    id: "dp7",
    contact: "Mia Roberts",
    treatment: "Dermal Filler",
    appointmentDate: "5 May 2026",
    depositAmount: 75,
    depositPaid: true,
    paidDate: "30 Apr 2026",
    method: "Card",
    showedUp: false,
    practitioner: "Dr. James Park",
    status: "paid",
    reminderSent: false,
    depositRequested: false,
  },
  {
    id: "dp8",
    contact: "Grace Lee",
    treatment: "Skin Treatment",
    appointmentDate: "4 May 2026",
    depositAmount: 50,
    depositPaid: true,
    paidDate: "29 Apr 2026",
    method: "Bank Transfer",
    showedUp: true,
    practitioner: "Dr. Emily Chen",
    status: "paid",
    reminderSent: false,
    depositRequested: false,
  },
];

export const DEPOSIT_STATUS_CONFIG: Record<
  string,
  { color: string; label: string }
> = {
  paid: { color: "bg-green-500/10 text-green-400", label: "Paid" },
  requested: { color: "bg-teal-500/10 text-teal-400", label: "Requested" },
  failed: { color: "bg-red-500/10 text-red-400", label: "Failed" },
  unpaid: { color: "bg-red-500/10 text-red-400", label: "Unpaid" },
  waived: { color: "bg-gray-500/10 text-gray-400", label: "Waived" },
  refunded: { color: "bg-amber-500/10 text-amber-400", label: "Refunded" },
};

export const DEPOSIT_ENFORCEMENT_POLICIES = [
  {
    treatment: "Botox Appointments",
    deposit: "£0 (optional)",
    showRate: "91%",
    recommendation: "No deposit needed — show rate already high",
    color: "text-green-400",
  },
  {
    treatment: "Filler Appointments",
    deposit: "£75",
    showRate: "74% → 92% (with deposit)",
    recommendation: "Enforce £75 deposit — predicted +18% show rate",
    color: "text-amber-400",
  },
  {
    treatment: "Consultations",
    deposit: "£25",
    showRate: "68% → 88% (with deposit)",
    recommendation: "Enforce £25 deposit — predicted +20% show rate",
    color: "text-red-400",
  },
  {
    treatment: "Skin Treatments",
    deposit: "£50",
    showRate: "82% → 94% (with deposit)",
    recommendation: "Enforce £50 deposit — predicted +12% show rate",
    color: "text-amber-400",
  },
] as const;
