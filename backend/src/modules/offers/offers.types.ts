export interface OfferResponse {
  id: string;
  name: string;
  discount: string;
  treatment: string;
  validUntil: string;
  redemptions: number;
  status: "active" | "scheduled" | "expired";
  description: string | null;
}

export interface CreateOfferDTO {
  name: string;
  discount: string;
  treatment: string;
  validUntil: string;
  redemptions?: number;
  status?: "active" | "scheduled" | "expired";
  description?: string;
}

export type UpdateOfferDTO = Partial<CreateOfferDTO>;
