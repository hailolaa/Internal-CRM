export type DataState =
  | "live"
  | "live-read-only"
  | "partial"
  | "provider-dependent"
  | "preview"
  | "roadmap"
  | "demo";

export const DATA_STATES: DataState[] = [
  "live",
  "live-read-only",
  "partial",
  "provider-dependent",
  "preview",
  "roadmap",
  "demo",
];

export type DataStateTone = "live" | "warning" | "info" | "neutral" | "demo";

export interface DataStatePresentation {
  label: string;
  description: string;
  tone: DataStateTone;
}

const PRESENTATION: Record<DataState, DataStatePresentation> = {
  live: {
    label: "Live",
    description: "Live workspace data",
    tone: "live",
  },
  "live-read-only": {
    label: "Live read-only",
    description: "Live provider data is visible but not write-enabled",
    tone: "info",
  },
  partial: {
    label: "Partial",
    description: "Some connected data is incomplete or manually supplied",
    tone: "warning",
  },
  "provider-dependent": {
    label: "Provider dependent",
    description: "Provider connection is required before this data is complete",
    tone: "warning",
  },
  preview: {
    label: "Preview",
    description: "Preview data used before production verification",
    tone: "info",
  },
  roadmap: {
    label: "Roadmap",
    description: "Roadmap capability, not live operational data",
    tone: "neutral",
  },
  demo: {
    label: "Demo",
    description: "Fictional demo data",
    tone: "demo",
  },
};

export function normaliseDataState(value: string | null | undefined): DataState {
  return DATA_STATES.includes(value as DataState) ? (value as DataState) : "live";
}

export function getDataStatePresentation(
  value: string | null | undefined,
  overrideLabel?: string | null,
): DataStatePresentation {
  const state = normaliseDataState(value);
  const presentation = PRESENTATION[state];
  return {
    ...presentation,
    description: overrideLabel?.trim() || presentation.description,
  };
}
