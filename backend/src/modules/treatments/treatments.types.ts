import type { treatmentCategories } from "./treatments.constants.js";

export type TreatmentCategory = typeof treatmentCategories[number];

export interface TreatmentCatalogResponse {
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

export interface CreateTreatmentDTO {
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

export type UpdateTreatmentDTO = Partial<CreateTreatmentDTO>;
