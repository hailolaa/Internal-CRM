export interface ReviewRecord {
  id: string;
  rating: number | null;
  comment: string | null;
  source: string | null;
  status: string | null;
  author: string;
  createdAt: string;
}

export interface ReputationSummaryRecord {
  googleReviewLink: string;
  googleReviewManagementUrl?: string;
  reviewRequestTemplate: string;
  manualReviewReceivedCount: number;
  reviewRequestsSentCount: number;
  reviewRequestsTotalCount: number;
  googleReviewSyncConnected: boolean;
  gbpIntegration?: {
    configured: boolean;
    setupStatus: string;
    healthStatus: string;
    directReplyAvailable: boolean;
    unavailableReason: string;
    missingPermissions: string[];
    managementUrl: string;
  };
  wording: string[];
  checklist: Array<{
    id: string;
    itemKey: string;
    label: string;
    completed: boolean;
  }>;
}

export interface ReviewReplyHandoffRecord {
  reviewId: string;
  source: string | null;
  directReplyAvailable: boolean;
  action: "open_external" | "unavailable";
  externalUrl: string | null;
  unavailableReason: string;
  requirements: string[];
}

export interface CampaignRecord {
  id: string;
  name: string;
  description: string | null;
  type: string | null;
  status: string | null;
  startDate: string | null;
  endDate: string | null;
  budget: number | null;
  channel: string | null;
  createdAt: string;
  media?: CampaignMediaRecord[];
}

export interface CampaignMediaRecord {
  id: string;
  campaignId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
  createdAt: string;
}

export interface ManualSpendRecord {
  id: string;
  source: string;
  channel: string | null;
  campaign: string;
  amount: number;
  period: string;
  startDate: string | null;
  endDate: string | null;
  attributionLabel: string | null;
  notes: string | null;
  enteredBy: string;
  enteredAt: string;
  clinicId: string;
}

export interface CompetitorRecord {
  id: string;
  name: string;
  url: string;
  keyTreatments: string[];
  pricePosition: "Budget" | "Mid-range" | "Premium";
  offer: string | null;
  messagingAngle: string | null;
  adPresence: { google: boolean; meta: boolean };
  seoStrength: "Strong" | "Medium" | "Weak";
  rating: number;
  reviews: number;
}

export interface OfferRecord {
  id: string;
  name: string;
  discount: string;
  treatment: string;
  validUntil: string;
  redemptions: number;
  status: "active" | "scheduled" | "expired";
  description: string | null;
}
