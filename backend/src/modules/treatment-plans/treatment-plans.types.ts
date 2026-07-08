export interface CreateTreatmentPlanDTO {
  contact: string;
  avatar?: string;
  treatment: string;
  items?: string[];
  totalValue?: number;
  paid?: number;
  outstanding?: number;
  status?: "active" | "completed" | "draft" | "archived";
  sessions?: number;
  sessionsCompleted?: number;
  nextSession?: string | null;
  practitioner?: string;
}

export type UpdateTreatmentPlanDTO = Partial<CreateTreatmentPlanDTO>;

