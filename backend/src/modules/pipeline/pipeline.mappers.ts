import type {
  PipelineDealListResponse,
  PipelineDealResponse,
  PipelineDealStatus,
  PipelineStageKind,
  PipelineStageResponse,
} from "./pipeline.types.js";

export function mapPipelineStage(row: any): PipelineStageResponse {
  return {
    id: row.id,
    pipelineId: row.pipelineId,
    name: row.name,
    color: row.color || "bg-blue-500",
    position: Number(row.position || 0),
    kind: row.kind || "open",
    isLocked: Boolean(row.isLocked),
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

function dateToIso(value: unknown) {
  return value ? new Date(value as string | number | Date).toISOString() : null;
}

function dateToKey(value: unknown) {
  return value ? new Date(value as string | number | Date).toISOString().split("T")[0] || null : null;
}

function getContactName(row: any) {
  const name = [row.contactFirstName, row.contactLastName].filter(Boolean).join(" ").trim();
  return name || row.contactEmail || "Unknown contact";
}

function getContactAvatar(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";
}

function mapDealStatus(value: unknown, stageKind: PipelineStageKind): PipelineDealStatus {
  if (value === "won" || value === "lost" || value === "open") return value;
  if (stageKind === "won" || stageKind === "lost") return stageKind;
  return "open";
}

export function mapPipelineDeal(row: any): PipelineDealResponse {
  const contactName = getContactName(row);
  const stageKind = (row.stageKind || "open") as PipelineStageKind;

  return {
    id: row.id,
    pipelineId: row.pipelineId,
    stageId: row.stageId || null,
    stageName: row.stageName || null,
    stageKind,
    title: row.title,
    valueCents: Math.round(Number(row.value || 0) * 100),
    probability: Number(row.probability || 0),
    expectedCloseDate: dateToKey(row.expectedCloseDate),
    ownerId: row.ownerId || null,
    ownerName: row.ownerName || null,
    nextFollowUpDate: dateToKey(row.nextFollowUpDate),
    priority: row.priority || null,
    contactId: row.contactId,
    contactName,
    contactEmail: row.contactEmail || null,
    contactPhone: row.contactPhone || null,
    contactAvatar: getContactAvatar(contactName),
    source: row.source || row.contactSource || null,
    treatment: row.treatment || null,
    status: mapDealStatus(row.status, stageKind),
    daysInStage: Number(row.daysInStage || 0),
    stageChangedAt: dateToIso(row.stageChangedAt),
    bookedAt: dateToIso(row.bookedAt),
    soldAt: dateToIso(row.soldAt),
    lostAt: dateToIso(row.lostAt),
    lostReason: row.lostReason || null,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

export function buildPipelineDealList(deals: PipelineDealResponse[]): PipelineDealListResponse {
  const totalValueCents = deals.reduce((sum, deal) => sum + deal.valueCents, 0);
  const dealsCount = deals.length;

  return {
    deals,
    summary: {
      averageDealValueCents: dealsCount > 0 ? Math.round(totalValueCents / dealsCount) : 0,
      dealsCount,
      totalValueCents,
    },
  };
}
