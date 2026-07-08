// ============================================================
// Mock data constants — single source of truth for demo data
// ============================================================

// --- Shared Contacts ---
export const SAMPLE_CONTACTS = [
  {
    id: "1",
    name: "Sarah Johnson",
    email: "sarah@email.com",
    phone: "07700 900123",
    source: "Google Ads",
    status: "Lead",
    tags: ["Botox", "High Intent"],
    lastContact: "2 hours ago",
    value: "£350",
    avatar: "SJ",
  },
  {
    id: "2",
    name: "Emma Wilson",
    email: "emma@email.com",
    phone: "07700 900456",
    source: "Instagram",
    status: "Booked",
    tags: ["Lip Filler"],
    lastContact: "1 day ago",
    value: "£550",
    avatar: "EW",
  },
  {
    id: "3",
    name: "Sophie Brown",
    email: "sophie@email.com",
    phone: "07700 900789",
    source: "Referral",
    status: "Patient",
    tags: ["VIP", "Regular"],
    lastContact: "3 days ago",
    value: "£2,400",
    avatar: "SB",
  },
  {
    id: "4",
    name: "Olivia Taylor",
    email: "olivia@email.com",
    phone: "07700 900012",
    source: "Website",
    status: "Lead",
    tags: ["Dermal Filler"],
    lastContact: "5 days ago",
    value: "£450",
    avatar: "OT",
  },
  {
    id: "5",
    name: "Charlotte Davis",
    email: "charlotte@email.com",
    phone: "07700 900345",
    source: "Google Ads",
    status: "Consultation",
    tags: ["Anti-wrinkle"],
    lastContact: "1 week ago",
    value: "£280",
    avatar: "CD",
  },
  {
    id: "6",
    name: "Amelia Roberts",
    email: "amelia@email.com",
    phone: "07700 900678",
    source: "Facebook",
    status: "Lead",
    tags: ["Skin Treatment"],
    lastContact: "2 days ago",
    value: "£320",
    avatar: "AR",
  },
] as const;

// --- Treatments ---
export const TREATMENTS = [
  { id: "1", name: "Botox - Full Face", duration: 45, price: "£350" },
  { id: "2", name: "Botox - Forehead Only", duration: 30, price: "£199" },
  { id: "3", name: "Lip Filler", duration: 45, price: "£299" },
  { id: "4", name: "Dermal Filler", duration: 60, price: "£450" },
  { id: "5", name: "Free Consultation", duration: 30, price: "Free" },
] as const;

export const TREATMENT_NAMES = [
  "All Treatments",
  "Botox",
  "Lip Filler",
  "Dermal Filler",
  "Skin Treatments",
  "Consultation",
  "Package Deal",
] as const;

// --- Providers ---
export const PROVIDERS = [
  { id: "1", name: "Dr. Sarah Smith", avatar: "SS" },
  { id: "2", name: "Dr. Emma Jones", avatar: "EJ" },
] as const;

// --- Team Members ---
export const TEAM_MEMBERS = [
  {
    id: "1",
    name: "Dr. Sarah Smith",
    email: "sarah@glowclinic.co.uk",
    role: "Owner",
    status: "active",
    lastActive: "Online",
  },
  {
    id: "2",
    name: "Emma Johnson",
    email: "emma@glowclinic.co.uk",
    role: "Admin",
    status: "active",
    lastActive: "2 hours ago",
  },
  {
    id: "3",
    name: "Sophie Brown",
    email: "sophie@glowclinic.co.uk",
    role: "Staff",
    status: "active",
    lastActive: "1 day ago",
  },
  {
    id: "4",
    name: "Olivia Taylor",
    email: "olivia@glowclinic.co.uk",
    role: "Staff",
    status: "invited",
    lastActive: "Pending",
  },
] as const;

// --- Role colours ---
export const ROLE_COLORS: Record<string, string> = {
  Owner: "bg-amber-500/10 text-amber-400",
  Manager: "bg-violet-500/10 text-violet-400",
  Reception: "bg-gray-500/10 text-gray-400",
  Practitioner: "bg-teal-500/10 text-teal-500",
  "Agency / Analyst": "bg-slate-500/10 text-slate-500",
  "Super Admin": "bg-orange-500/10 text-orange-500",
};

// --- Pipeline Stage Colours ---
export const STAGE_COLORS: Record<string, string> = {
  New: "bg-blue-500/10 text-blue-400",
  Contacted: "bg-cyan-500/10 text-cyan-400",
  "Consult Booked": "bg-amber-500/10 text-amber-400",
  "Consult Attended": "bg-purple-500/10 text-purple-400",
  "Treatment Booked": "bg-indigo-500/10 text-indigo-400",
  Treated: "bg-emerald-500/10 text-emerald-400",
  Lost: "bg-red-500/10 text-red-400",
};

// --- Time Slots ---
export const TIME_SLOTS = [
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
] as const;

// --- Form Field Types ---
export const FORM_FIELD_TYPES = [
  { type: "text", label: "Text" },
  { type: "email", label: "Email" },
  { type: "phone", label: "Phone" },
  { type: "date", label: "Date" },
  { type: "checkbox", label: "Checkbox" },
  { type: "select", label: "Dropdown" },
  { type: "textarea", label: "Long Text" },
] as const;

// --- Priorities ---
export const PRIORITIES = [
  { id: "high", name: "High", color: "bg-red-500" },
  { id: "medium", name: "Medium", color: "bg-amber-500" },
  { id: "low", name: "Low", color: "bg-gray-500" },
] as const;

// --- Task Categories ---
export const TASK_CATEGORIES = [
  "Follow-up",
  "Call",
  "Email",
  "Documentation",
  "Preparation",
  "Admin",
  "Marketing",
] as const;

// --- Channel Config ---
export const CHANNEL_ICONS = {
  email: { color: "text-blue-400", bg: "bg-blue-500/10" },
  sms: { color: "text-green-400", bg: "bg-green-500/10" },
  whatsapp: { color: "text-emerald-400", bg: "bg-emerald-500/10" },
  phone: { color: "text-amber-400", bg: "bg-amber-500/10" },
} as const;
