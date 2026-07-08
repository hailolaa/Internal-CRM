export interface CreateSequenceDTO {
  name: string;
  triggerLabel: string;
  steps?: unknown[];
  status?: "active" | "paused" | "draft" | "archived";
}

export type UpdateSequenceDTO = Partial<CreateSequenceDTO> & {
  enrolledCount?: number;
  completedCount?: number;
};

export interface EnrollSequenceDTO {
  contactId: string;
}

