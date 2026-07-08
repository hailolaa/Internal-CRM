import { defaultTreatmentCategory } from "./treatments.constants.js";
import type { TreatmentCatalogResponse } from "./treatments.types.js";

export function mapTreatmentCatalog(row: any): TreatmentCatalogResponse {
  return {
    id: row.id,
    name: row.name,
    description: row.description || null,
    category: row.category || defaultTreatmentCategory,
    durationMinutes: row.durationMinutes === null ? null : Number(row.durationMinutes),
    priceCents: row.priceCents === null ? null : Number(row.priceCents),
    averageValueCents: row.averageValueCents === null ? null : Number(row.averageValueCents),
    marginPercent: row.marginPercent === null ? null : Number(row.marginPercent),
    priority: Number(row.priority || 0),
    isHighTicket: Boolean(row.isHighTicket),
    status: row.status,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}
