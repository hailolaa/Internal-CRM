export type NextBestActionKind =
  | "contact_lead"
  | "growth_score_follow_up"
  | "audit_follow_up"
  | "proposal_follow_up"
  | "client_access"
  | "client_upsell"
  | "client_review"
  | "task_follow_up"
  | "general_follow_up";

export type NextBestActionUrgency = "high" | "medium" | "low";

export interface NextBestActionResult {
  kind: NextBestActionKind;
  label: string;
  detail: string;
  urgency: NextBestActionUrgency;
  href?: string;
}

export interface LeadNextBestActionInput {
  auditStatus?: string | null;
  contactId?: string | null;
  followUpOverdue?: boolean;
  guideSignal?: string | null;
  packageInterest?: string | null;
  source?: string | null;
  stage?: string | null;
  status?: string | null;
  attemptCount?: number | null;
}

export interface ClientNextBestActionInput {
  churnRisk?: string | null;
  clientStatus?: string | null;
  contractStatus?: string | null;
  currentPackage?: string | null;
  googleDriveFolderAccessStatus?: string | null;
  googleDriveFolderId?: string | null;
  healthStatus?: string | null;
  href?: string;
  nextTaskTitle?: string | null;
  onboardingStatus?: string | null;
  overdueTaskCount?: number | null;
  recommendedNextPackage?: string | null;
  renewalDate?: string | null;
  upsellOpportunity?: string | null;
}

function compact(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function includesAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

function hasPackageGap(currentPackage?: string | null, nextPackage?: string | null) {
  const current = compact(currentPackage);
  const next = compact(nextPackage);
  return Boolean(next && next !== "not set" && next !== current);
}

function isRenewalDue(value?: string | null) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return (date.getTime() - Date.now()) / 86400000 <= 30;
}

export function nextBestActionBadgeClass(urgency: NextBestActionUrgency) {
  if (urgency === "high") return "border-red-200 bg-red-50 text-red-700";
  if (urgency === "medium") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-[#D5E7E3] bg-[#edf5f3] text-[#315f62]";
}

export function getLeadNextBestAction(input: LeadNextBestActionInput): NextBestActionResult {
  const stage = compact(input.stage);
  const source = compact(input.source);
  const packageInterest = compact(input.packageInterest);
  const guideSignal = compact(input.guideSignal);
  const href = input.contactId ? `/app/crm/contacts/detail?id=${encodeURIComponent(input.contactId)}` : undefined;

  if ((input.attemptCount || 0) === 0 || input.status === "uncontacted" || input.status === "overdue") {
    return {
      kind: "contact_lead",
      label: "Call/contact lead",
      detail: input.status === "overdue" ? "New lead has breached response SLA." : "New lead has no recorded contact attempt.",
      urgency: input.status === "overdue" ? "high" : "medium",
      href,
    };
  }

  if (includesAny(`${source} ${guideSignal}`, ["website_lead_magnet", "lead magnet", "free guide", "guide"])) {
    return {
      kind: "growth_score_follow_up",
      label: "Offer Growth Score",
      detail: "Free guide lead should be moved toward the Clinic Growth Score audit.",
      urgency: "medium",
      href,
    };
  }

  if (input.auditStatus === "audit_completed" || input.auditStatus === "growth_score_created") {
    return {
      kind: "audit_follow_up",
      label: "Proposal/dashboard follow-up",
      detail: "Audit is complete, so follow up with proposal or dashboard access.",
      urgency: "high",
      href,
    };
  }

  if (includesAny(stage, ["proposal sent", "proposal"])) {
    return {
      kind: "proposal_follow_up",
      label: "Chase proposal",
      detail: "Proposal-stage lead needs a clear follow-up.",
      urgency: input.followUpOverdue ? "high" : "medium",
      href,
    };
  }

  if (packageInterest) {
    return {
      kind: "general_follow_up",
      label: "Qualify package fit",
      detail: "Confirm fit, decision maker, timing, and next step.",
      urgency: "low",
      href,
    };
  }

  return {
    kind: "general_follow_up",
    label: "Review lead",
    detail: "Review source and add the next sales task.",
    urgency: "low",
    href,
  };
}

export function getClientNextBestAction(input: ClientNextBestActionInput): NextBestActionResult {
  if ((input.overdueTaskCount || 0) > 0) {
    return {
      kind: "task_follow_up",
      label: "Clear overdue task",
      detail: input.nextTaskTitle || "Client has overdue internal work.",
      urgency: "high",
      href: input.href,
    };
  }

  if (!input.googleDriveFolderId || input.googleDriveFolderAccessStatus === "inaccessible") {
    return {
      kind: "client_access",
      label: "Fix missing access",
      detail: "Client Drive/access is missing or inaccessible.",
      urgency: "high",
      href: input.href,
    };
  }

  if (input.upsellOpportunity || hasPackageGap(input.currentPackage, input.recommendedNextPackage)) {
    return {
      kind: "client_upsell",
      label: "Review upsell",
      detail: input.upsellOpportunity || `Recommended next package: ${input.recommendedNextPackage}`,
      urgency: "medium",
      href: input.href,
    };
  }

  if (["at_risk", "critical"].includes(input.healthStatus || "") || ["high", "critical"].includes(input.churnRisk || "")) {
    return {
      kind: "client_review",
      label: "Schedule client review",
      detail: "Client health or churn risk needs review.",
      urgency: "high",
      href: input.href,
    };
  }

  if (input.onboardingStatus === "in_progress" || input.contractStatus === "pending") {
    return {
      kind: "client_review",
      label: "Complete onboarding",
      detail: "Client is still onboarding or contract is pending.",
      urgency: "medium",
      href: input.href,
    };
  }

  if (isRenewalDue(input.renewalDate)) {
    return {
      kind: "client_review",
      label: "Prepare renewal review",
      detail: "Renewal is due soon.",
      urgency: "medium",
      href: input.href,
    };
  }

  return {
    kind: "client_review",
    label: "Routine account review",
    detail: "No urgent issue detected.",
    urgency: "low",
    href: input.href,
  };
}
