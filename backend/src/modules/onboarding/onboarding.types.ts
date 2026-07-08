export type OnboardingStepKey =
  | "clinic-basics"
  | "team"
  | "treatments"
  | "lead-sources"
  | "call-tracking"
  | "marketing"
  | "competitors"
  | "reviews";

export interface OnboardingState {
  [step: string]: any;
}

export interface OnboardingStatus {
  clinicId: string;
  data: OnboardingState;
  steps: Record<OnboardingStepKey, { completed: boolean; missing?: string[] }>;
  completionPercentage: number;
  requiredFields: Record<string, { completed: boolean; missing: string[] }>;
  defaults: {
    callOutcomes: ReadonlyArray<{ value: string; label: string }>;
    consultOutcomes: ReadonlyArray<{ value: string; label: string }>;
  };
  completedAt?: string | null;
}

export interface PatchStepDTO {
  step: OnboardingStepKey;
  payload: any;
}
