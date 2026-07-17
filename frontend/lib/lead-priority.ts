export type LeadPriorityTier = "hot" | "warm" | "nurture" | "low";

export interface LeadPriorityInput {
  accountName?: string | null;
  auditOverdue?: boolean;
  auditStatus?: string | null;
  ctaClicked?: string | null;
  followUpOverdue?: boolean;
  formSubmitted?: string | null;
  lastContactAt?: string | null;
  landingPage?: string | null;
  packageInterest?: string | null;
  recommendedPackage?: string | null;
  source?: string | null;
  stage?: string | null;
  status?: string | null;
  tags?: string[] | null;
  attemptCount?: number | null;
}

export interface LeadPriorityResult {
  score: number;
  tier: LeadPriorityTier;
  label: string;
  reasons: string[];
}

const packageScores = [
  { match: "market leader", score: 30, reason: "Market Leader interest" },
  { match: "growth engine", score: 25, reason: "Growth Engine interest" },
  { match: "performance os", score: 22, reason: "Performance OS interest" },
  { match: "lead concierge", score: 16, reason: "Lead Concierge interest" },
  { match: "growth diagnostic", score: 12, reason: "Growth Diagnostic interest" },
  { match: "clinic growth score", score: 10, reason: "Clinic Growth Score interest" },
];

function compact(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function includesAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

function packageScore(input: LeadPriorityInput) {
  const value = compact(`${input.packageInterest || ""} ${input.recommendedPackage || ""}`);
  if (!value || value === "-") return null;
  return packageScores.find((item) => value.includes(item.match)) || {
    score: 6,
    reason: "Package interest recorded",
  };
}

function tierForScore(score: number): LeadPriorityTier {
  if (score >= 70) return "hot";
  if (score >= 45) return "warm";
  if (score >= 20) return "nurture";
  return "low";
}

export function leadPriorityLabel(tier: LeadPriorityTier) {
  if (tier === "hot") return "Hot";
  if (tier === "warm") return "Warm";
  if (tier === "nurture") return "Nurture";
  return "Low";
}

export function leadPriorityBadgeClass(tier: LeadPriorityTier) {
  if (tier === "hot") return "border-red-200 bg-red-50 text-red-700";
  if (tier === "warm") return "border-amber-200 bg-amber-50 text-amber-700";
  if (tier === "nurture") return "border-cyan-200 bg-cyan-50 text-cyan-700";
  return "border-[#E7E1DA] bg-[#F6F3EF] text-[#6F6A66]";
}

export function calculateLeadPriority(input: LeadPriorityInput): LeadPriorityResult {
  const reasons: string[] = [];
  let score = 0;
  const text = compact([
    input.accountName,
    input.ctaClicked,
    input.formSubmitted,
    input.landingPage,
    input.packageInterest,
    input.recommendedPackage,
    input.source,
    input.stage,
    input.status,
    ...(input.tags || []),
  ].filter(Boolean).join(" "));

  const packageRule = packageScore(input);
  if (packageRule) {
    score += packageRule.score;
    reasons.push(packageRule.reason);
  }

  if (
    ["audit_requested", "audit_assigned", "audit_started", "growth_score_created", "follow_up_due"].includes(input.auditStatus || "")
    || includesAny(text, ["audit", "growth score", "diagnostic", "demo"])
  ) {
    score += 20;
    reasons.push("Audit/demo intent");
  }

  if (includesAny(text, ["lead_magnet", "lead magnet", "free guide", "guide download", "guide"])) {
    score += 10;
    reasons.push("Guide download or lead magnet");
  }

  if (includesAny(text, ["multi-location", "multi location", "multiple locations", "group", "chain"])) {
    score += 10;
    reasons.push("Multi-location signal");
  }

  if (includesAny(text, ["proposal"])) {
    score += 18;
    reasons.push("Proposal engagement");
  }

  if (input.auditOverdue) {
    score += 10;
    reasons.push("Audit follow-up due");
  }

  if (input.followUpOverdue) {
    score += 8;
    reasons.push("Sales follow-up overdue");
  }

  if (input.status === "overdue") {
    score += 14;
    reasons.push("Response SLA overdue");
  } else if (input.status === "uncontacted") {
    score += 8;
    reasons.push("Uncontacted lead");
  }

  if ((input.attemptCount || 0) > 0 || input.lastContactAt) {
    score += 4;
    reasons.push("Contact activity exists");
  }

  const cappedScore = Math.min(100, Math.max(0, score));
  const tier = tierForScore(cappedScore);
  return {
    score: cappedScore,
    tier,
    label: leadPriorityLabel(tier),
    reasons: reasons.length ? reasons : ["No strong priority signals yet"],
  };
}
