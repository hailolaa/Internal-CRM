export type PackageBillingFrequency = "one_off" | "monthly" | "quarterly" | "annual" | "bespoke";
export type PackageStatus = "active" | "inactive" | "archived";

export interface PackageRecord {
  id: string;
  name: string;
  priceCents: number | null;
  currency: string;
  billingFrequency: PackageBillingFrequency;
  setupFeeCents: number | null;
  includedFeatures: string[];
  internalNotes: string | null;
  proposalWording: string | null;
  sortOrder: number;
  status: PackageStatus;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PackagePayload {
  name?: string;
  priceCents?: number | string | null;
  currency?: string | null;
  billingFrequency?: PackageBillingFrequency | null;
  setupFeeCents?: number | string | null;
  includedFeatures?: string[];
  internalNotes?: string | null;
  proposalWording?: string | null;
  sortOrder?: number | string | null;
  status?: PackageStatus | null;
}
