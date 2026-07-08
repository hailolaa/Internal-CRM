export interface CreateFormDTO {
  name: string;
  type?: string;
  status?: "active" | "draft" | "archived";
  fields?: unknown[];
}

export type UpdateFormDTO = Partial<CreateFormDTO>;

