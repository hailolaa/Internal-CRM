export interface AutomationResponse {
  id: string;
  name: string;
  description: string | null;
  triggerType: string | null;
  actions: unknown[];
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAutomationDTO {
  name: string;
  description?: string;
  triggerType?: string;
  actions?: unknown[];
  isEnabled?: boolean;
}

export type UpdateAutomationDTO = Partial<CreateAutomationDTO>;
