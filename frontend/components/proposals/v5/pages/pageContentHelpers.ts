import type { ProposalV5EvidenceState } from "../data/proposalV5Types";

export function evidenceStateLabel(state: ProposalV5EvidenceState) {
  if (state === "known") return "Known";
  if (state === "working_diagnosis") return "Working diagnosis";
  if (state === "provisional") return "Provisional";
  return "To confirm";
}

export function normaliseText(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ");
}
