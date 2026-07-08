import type { SlaBreachResponse, SlaLeadQueueItem, SlaLeadStatus } from "./sla.types.js";

export function getLeadName(row: any) {
  const name = [row.firstName, row.lastName].filter(Boolean).join(" ").trim();
  return name || row.email || row.phone || "Unknown lead";
}

export function getPrimaryTreatment(value: unknown) {
  const treatments = parseJson(value, []);

  if (Array.isArray(treatments) && treatments.length > 0) {
    const firstTreatment = treatments[0];
    if (typeof firstTreatment === "string" && firstTreatment.trim()) {
      return firstTreatment;
    }
  }

  return "Consultation";
}

export function getSlaStatus(elapsedMinutes: number, targetMinutes: number, breachedAt: unknown): SlaLeadStatus {
  if (breachedAt || elapsedMinutes >= targetMinutes) return "breached";
  if (elapsedMinutes >= targetMinutes * 0.8) return "warning";
  return "safe";
}

export function mapSlaLead(row: any): SlaLeadQueueItem {
  const elapsedMinutes = Number(row.elapsedMinutes || 0);
  const targetMinutes = Number(row.slaTargetMinutes || 5);

  return {
    contactId: row.contactId,
    name: getLeadName(row),
    source: row.source || "Unknown",
    treatment: getPrimaryTreatment(row.treatmentInterests),
    arrivedAt: new Date(row.arrivedAt).toISOString(),
    elapsedMinutes,
    slaTargetMinutes: targetMinutes,
    status: getSlaStatus(elapsedMinutes, targetMinutes, row.slaBreachedAt),
    assignedTo: row.assignedTo?.trim() || "Unassigned",
    estimatedValue: Number(row.estimatedValue || 0),
  };
}

export function mapSlaBreach(row: any): SlaBreachResponse {
  const actualMinutes = Number(row.actualMinutes || 0);
  const targetMinutes = Number(row.slaTargetMinutes || 5);

  return {
    id: row.id,
    contactId: row.contactId,
    leadName: getLeadName(row),
    source: row.source || "Unknown",
    treatment: getPrimaryTreatment(row.treatmentInterests),
    slaTargetMinutes: targetMinutes,
    actualMinutes,
    breachMinutes: Math.max(0, actualMinutes - targetMinutes),
    assignedTo: row.assignedTo?.trim() || "Unassigned",
    breachedAt: new Date(row.breachedAt).toISOString(),
    reason: row.firstResponseAt ? "Response after SLA target" : "No first response recorded",
    estimatedRevenueRisk: Number(row.estimatedRevenueRisk || 0),
    riskLabel: "estimated",
  };
}

function parseJson(value: unknown, fallback: unknown) {
  if (!value) return fallback;
  if (typeof value === "object") return value;

  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}
