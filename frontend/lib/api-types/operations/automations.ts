export interface AutomationRecord {
  id: string;
  name: string;
  description: string | null;
  triggerType: string | null;
  actions: unknown[];
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}
