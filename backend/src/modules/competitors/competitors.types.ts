export interface CreateCompetitorDTO {
  name: string;
  url: string;
  keyTreatments?: string[];
  pricePosition?: "Budget" | "Mid-range" | "Premium";
  offer?: string;
  messagingAngle?: string;
  adPresence?: { google?: boolean; meta?: boolean };
  seoStrength?: "Strong" | "Medium" | "Weak";
  rating?: number;
  reviews?: number;
}

export type UpdateCompetitorDTO = Partial<CreateCompetitorDTO>;

