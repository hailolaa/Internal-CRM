export type TreatmentCategory =
  | "Injectables"
  | "Skin"
  | "Aesthetics"
  | "Cosmetic Dentistry"
  | "Laser"
  | "Body"
  | "Surgery"
  | "Wellness"
  | "Other";

export interface TreatmentCatalogItem {
  id: string;
  name: string;
  description: string | null;
  category: TreatmentCategory;
  durationMinutes: number | null;
  priceCents: number | null;
  averageValueCents: number | null;
  marginPercent: number | null;
  priority: number;
  isHighTicket: boolean;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

export interface TreatmentCatalogPayload {
  name: string;
  description?: string;
  category?: TreatmentCategory;
  durationMinutes?: number;
  priceCents?: number;
  averageValueCents?: number;
  marginPercent?: number;
  priority?: number;
  isHighTicket?: boolean;
  status?: "active" | "inactive";
}

export interface TreatmentPlanRecord {
  id: string;
  contactId: string | null;
  contact: string;
  avatar: string | null;
  treatment: string;
  items: string[];
  totalValue: number;
  paid: number;
  outstanding: number;
  status: string;
  sessions: number;
  sessionsCompleted: number;
  createdAt: string;
  nextSession: string | null;
  practitioner: string | null;
}
