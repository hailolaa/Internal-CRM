import type { GrowthPackageRecord, PackageBillingFrequency } from "@/lib/api-types/packages";
import type {
  ProposalDataState,
  ProposalProofAssetRecord,
  ProposalPublicRecord,
  ProposalRecord,
  ProposalSectorImage,
  ProposalSectionContent,
} from "@/lib/api-types/proposals";
import { getProposalV5ClinicTypeVariant } from "./clinicTypeVariants";
import type {
  ProposalV5EvidenceState,
  ProposalV5Image,
  ProposalV5ImageSlot,
  ProposalV5Package,
  ProposalV5ProofAsset,
  ProposalV5Snapshot,
  ProposalV5Stated,
} from "./proposalV5Types";
import { getProposalV5ProofReadinessMissingFields } from "./proofValidation";
import { proposalV5PageOrder } from "../pages/pageOrder";
import { resolveProposalV5Scope } from "./packageScope";

type ProposalV5SourceProposal = ProposalRecord | ProposalPublicRecord;

export interface BuildProposalV5SnapshotInput {
  proposal: ProposalV5SourceProposal;
  packageRecord?: Partial<GrowthPackageRecord> | null;
  generatedAt?: string;
  sourceProposalVersion?: string;
  acceptanceUrl?: string | null;
  questionUrl?: string | null;
}

function cleanString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

function normalizeDate(value: unknown): string | null {
  const cleaned = cleanString(value);
  if (!cleaned) return null;
  const date = new Date(cleaned);
  return Number.isNaN(date.getTime()) ? cleaned : date.toISOString();
}

function normalizeState(value: unknown): ProposalV5EvidenceState {
  if (value === "known" || value === "confirmed_on_call") return "known";
  if (value === "working_diagnosis" || value === "provisional" || value === "to_confirm") return value;
  return "to_confirm";
}

function stated<T>(
  value: T | null,
  state: ProposalDataState | "confirmed_on_call" | null | undefined,
  source: string | null = null,
  sourceDate: string | null = null,
  customerWording: string | null = null,
): ProposalV5Stated<T> {
  return {
    value,
    state: normalizeState(state),
    source,
    sourceDate,
    customerWording,
  };
}

function splitLines(value: string | string[] | null | undefined): string[] {
  if (Array.isArray(value)) return value.map((item) => cleanString(item)).filter((item): item is string => Boolean(item));
  const cleaned = cleanString(value);
  if (!cleaned) return [];
  return cleaned
    .split(/\r?\n|;/)
    .map((item) => cleanString(item))
    .filter((item): item is string => Boolean(item));
}

function parseMoney(value: string | null | undefined): number | null {
  const cleaned = cleanString(value);
  if (!cleaned) return null;
  const match = cleaned.replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

function getProposalId(proposal: ProposalV5SourceProposal): string | null {
  return "id" in proposal ? proposal.id : null;
}

function getProposalCreatedAt(proposal: ProposalV5SourceProposal): string | null {
  return "createdAt" in proposal ? proposal.createdAt : null;
}

function getProposalUpdatedAt(proposal: ProposalV5SourceProposal): string | null {
  return "updatedAt" in proposal ? proposal.updatedAt : null;
}

function getProposalStatus(proposal: ProposalV5SourceProposal) {
  return "status" in proposal ? proposal.status : null;
}

function getRecommendedPackageId(proposal: ProposalV5SourceProposal): string | null {
  return "recommendedPackageId" in proposal ? proposal.recommendedPackageId : null;
}

function getContactEmail(proposal: ProposalV5SourceProposal): string | null {
  return "contactEmail" in proposal ? proposal.contactEmail : null;
}

function getAcceptanceHash(proposal: ProposalV5SourceProposal): string | null {
  return "acceptanceRecord" in proposal ? proposal.acceptanceRecord?.evidenceSha256 || null : null;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

const sha256InitialHash = [
  0x6a09e667,
  0xbb67ae85,
  0x3c6ef372,
  0xa54ff53a,
  0x510e527f,
  0x9b05688c,
  0x1f83d9ab,
  0x5be0cd19,
] as const;

const sha256RoundConstants = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
] as const;

function rotateRight(value: number, bits: number) {
  return (value >>> bits) | (value << (32 - bits));
}

function sha256(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const bitLength = bytes.length * 8;
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const data = new Uint8Array(paddedLength);
  data.set(bytes);
  data[bytes.length] = 0x80;

  const bitLengthHigh = Math.floor(bitLength / 0x100000000);
  const bitLengthLow = bitLength >>> 0;
  data[paddedLength - 8] = (bitLengthHigh >>> 24) & 0xff;
  data[paddedLength - 7] = (bitLengthHigh >>> 16) & 0xff;
  data[paddedLength - 6] = (bitLengthHigh >>> 8) & 0xff;
  data[paddedLength - 5] = bitLengthHigh & 0xff;
  data[paddedLength - 4] = (bitLengthLow >>> 24) & 0xff;
  data[paddedLength - 3] = (bitLengthLow >>> 16) & 0xff;
  data[paddedLength - 2] = (bitLengthLow >>> 8) & 0xff;
  data[paddedLength - 1] = bitLengthLow & 0xff;

  const hash: number[] = [...sha256InitialHash];
  const words = new Uint32Array(64);

  for (let chunk = 0; chunk < data.length; chunk += 64) {
    words.fill(0);
    for (let index = 0; index < 16; index += 1) {
      const offset = chunk + index * 4;
      words[index] = (
        (data[offset] << 24) |
        (data[offset + 1] << 16) |
        (data[offset + 2] << 8) |
        data[offset + 3]
      ) >>> 0;
    }

    for (let index = 16; index < 64; index += 1) {
      const s0 = (rotateRight(words[index - 15], 7) ^ rotateRight(words[index - 15], 18) ^ (words[index - 15] >>> 3)) >>> 0;
      const s1 = (rotateRight(words[index - 2], 17) ^ rotateRight(words[index - 2], 19) ^ (words[index - 2] >>> 10)) >>> 0;
      words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const s1 = (rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25)) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const temp1 = (h + s1 + ch + sha256RoundConstants[index] + words[index]) >>> 0;
      const s0 = (rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22)) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const temp2 = (s0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }

  return hash.map((value) => value.toString(16).padStart(8, "0")).join("");
}

function canonicalSha256Hash(value: unknown): string {
  return sha256(stableStringify(value));
}

function mapSectorImage(
  slot: ProposalV5ImageSlot,
  image: Partial<ProposalSectorImage> | null | undefined,
  fallback: ProposalV5Image,
): ProposalV5Image {
  return {
    slot,
    imageId: cleanString(image?.imageId) || fallback.imageId,
    url: cleanString(image?.url) || fallback.url,
    alt: fallback.alt,
    cropPosition: cleanString(image?.cropPosition) || fallback.cropPosition,
    licence: cleanString(image?.licence) || fallback.licence,
    provenance: cleanString(image?.provenance) || fallback.provenance,
    approvalStatus: image?.approvalStatus || fallback.approvalStatus,
  };
}

function proofMetadataValue(tags: string[], key: string): string | null {
  const canonicalKey = key.trim().toLowerCase().replace(/[_\s]+/g, "-");
  const matchingTag = tags.find((tag) => {
    const separatorIndex = tag.indexOf(":");
    if (separatorIndex < 0) return false;
    const tagKey = tag.slice(0, separatorIndex).trim().toLowerCase().replace(/[_\s]+/g, "-");
    return tagKey === canonicalKey;
  });
  if (!matchingTag) return null;
  return cleanString(matchingTag.slice(matchingTag.indexOf(":") + 1));
}

function mapProof(asset: ProposalProofAssetRecord): ProposalV5ProofAsset {
  const sectorTags = asset.sectorTags || [];
  return {
    id: asset.id,
    type: asset.type,
    title: cleanString(asset.title),
    copy: cleanString(asset.copy),
    mediaUrl: cleanString(asset.mediaUrl),
    sectorTags,
    state: normalizeState(proofMetadataValue(sectorTags, "state")),
    proofMode: proofMetadataValue(sectorTags, "proof-mode"),
    proofScope: proofMetadataValue(sectorTags, "proof-scope"),
    source: proofMetadataValue(sectorTags, "source"),
    timeframe: proofMetadataValue(sectorTags, "timeframe"),
    disclaimer: proofMetadataValue(sectorTags, "disclaimer"),
  };
}

function buildPackageSnapshot(
  proposal: ProposalV5SourceProposal,
  packageRecord: Partial<GrowthPackageRecord> | null | undefined,
): ProposalV5Package {
  return {
    id: packageRecord?.id || getRecommendedPackageId(proposal),
    catalogueVersion: packageRecord?.catalogueVersion || null,
    name: packageRecord?.name || proposal.packageName || null,
    monthlyFeeCents: proposal.monthlyFeeCents ?? (packageRecord?.billingFrequency === "monthly" ? packageRecord?.priceCents ?? null : null),
    setupFeeCents: proposal.setupFeeCents ?? packageRecord?.setupFeeCents ?? null,
    currency: proposal.currency || packageRecord?.currency || "GBP",
    billingFrequency: (packageRecord?.billingFrequency || null) as PackageBillingFrequency | null,
    vatStatus: proposal.vatStatus || null,
    mediaSpendRule: proposal.adSpendNote || null,
    minimumTermMonths: proposal.minimumTermMonths || null,
    noticePeriodDays: proposal.noticePeriodDays || null,
  };
}

function evidenceStateCopy(state: ProposalV5EvidenceState) {
  if (state === "known") return "known";
  if (state === "working_diagnosis") return "working diagnosis";
  if (state === "provisional") return "provisional";
  return "to confirm";
}

function joinProposalList(values: string[], maxItems = 2) {
  return values.slice(0, maxItems).join(" and ");
}

function buildNarrative({
  clinicTypeLabel,
  priorityServices,
  currentSystems,
  currentSystemsState,
}: {
  clinicTypeLabel: string;
  priorityServices: string[];
  currentSystems: string | null;
  currentSystemsState: ProposalV5EvidenceState;
}): ProposalV5Snapshot["narrative"] {
  const clinicType = clinicTypeLabel.toLowerCase();
  const primaryService = priorityServices[0] || "";
  const servicesText = joinProposalList(priorityServices);

  return {
    partnerProposition: {
      eyebrow: "Why ClinicGrower owns both",
      headline: "One partner should own demand and patient progression.",
      lede:
        "ClinicGrower can manage agreed website improvements, paid media and SEO, while ClinicGrower OS follows the supported journey through enquiry, response, booking, attendance, follow-up and recorded value where connected.",
      founderLabel: "Max Sharpe - founder and managing director",
      videoCtaLabel: "Meet Max, founder",
      credentialStatement: "Aesthetics Awards: Highly Commended 2025 - Finalist 2026, Best Service or Solution Provider",
      footerNote: "Product evidence remains source, connection and permission dependent.",
    },
    systemsFit: {
      eyebrow: "Fits your clinic",
      headline: `Fits your current systems. Configured for ${clinicType}.`,
      lede: "Keep working clinical systems. Add the commercial layer around one priority journey.",
      panels: [
        {
          label: "01 - Keep",
          title: "Keep the systems your team needs for care.",
          text: currentSystems ? `${currentSystems} (${evidenceStateCopy(currentSystemsState)}).` : "",
        },
        {
          label: "02 - Connect",
          title: "Connect supported demand and progression evidence.",
          text: "Supported sources are confirmed and mapped before final scope is issued.",
        },
        {
          label: "03 - Configure",
          title: primaryService ? `Build around ${primaryService} first.` : "",
          text: "Start with one service journey, one response standard and one accountable operating rhythm.",
        },
      ],
      imageCaption: "Sector-specific journey, language, priorities and commercial unit.",
      closeStatement: "Keep what works. Make the commercial hand-offs visible. Fix the first verified constraint.",
      footerNote: "Private and confidential.",
    },
    osCapability: {
      eyebrow: "The complete operating layer",
      headline: "One Growth Operating System - useful when evidence is connected.",
      lede: "Visibility depends on supported sources, permissions, data quality and scope.",
      availableTitle: "One commercial operating layer",
      availableItems: [
        "Demand, enquiries and pipeline",
        "Response, overdue actions and ownership",
        "Attribution and recorded value where supported",
      ],
      dependentTitle: "Live clinic evidence",
      dependentItems: [
        "Current, permitted source data",
        "Supported diary, PMS, CRM or accounts",
        "Accurate status and human review",
      ],
      capabilities: [
        { title: "Morning Brief", text: "Daily exceptions." },
        { title: "Max + AI", text: "Developing capability; human review is required." },
        { title: "Audit trail", text: "Source, time, owner and action." },
        { title: "Human ownership", text: "AI does not replace clinical judgement or a named process owner." },
      ],
      closeStatement: "Complete product. Honest boundaries. Human-reviewed decisions a clinic owner can defend.",
      footerNote: "Availability depends on agreed scope, supported connections, permissions and data quality.",
    },
    implementation: {
      eyebrow: "Your first 90 days",
      headline: "A controlled implementation - with a decision at every checkpoint.",
      lede: "First establish the truth. Then fix the first verified constraint before asking the clinic to scale.",
      checkpoints: [
        {
          label: "Days 1-14",
          title: "Establish the baseline",
          text: primaryService ? `Connect agreed sources, confirm capacity and baseline ${primaryService}.` : "",
        },
        {
          label: "Day 30",
          title: "Fix the first leak",
          text: "Act on the first verified demand or progression constraint.",
        },
        {
          label: "Day 60",
          title: "Decide what earns more effort",
          text: "Review demand, response, bookings, attendance and recorded value.",
        },
        {
          label: "Day 90",
          title: "Scale, hold or change route",
          text: "Decide against the evidence, capacity and clinic economics.",
        },
      ],
      imageCaption: servicesText ? `Built around ${servicesText}, real capacity and the first verified constraint.` : "",
      decisionTitle: "Day 90 decision",
      decisionText: "Scale, hold or change the route.",
      footerNote: "Private and confidential.",
    },
    responsibilities: {
      providerLabel: "ClinicGrower owns",
      providerTitle: "Delivery of the accepted scope.",
      clientTitle: "Access, approvals and clinic-side decisions.",
      lede: "The proposal is only decision-ready when the delivery owner, clinic owner and access dependencies are visible before price.",
      transitionLabel: "Before price",
      transitionText: "The scope is clear. The responsibilities are clear. The investment can now be judged against evidence.",
    },
  };
}

export function buildProposalV5Snapshot(input: BuildProposalV5SnapshotInput): ProposalV5Snapshot {
  const { proposal, packageRecord = null } = input;
  const section: ProposalSectionContent = proposal.sectionContent || {};
  const clinicVariant = getProposalV5ClinicTypeVariant(section.clinicTypeVariant);
  const savedImages = Array.isArray(section.sectorImages) ? section.sectorImages : [];
  const savedImageBySlot = new Map(savedImages.map((image) => [image.slot, image]));
  const generatedAt = normalizeDate(
    input.generatedAt ||
    getProposalUpdatedAt(proposal) ||
    getProposalCreatedAt(proposal) ||
    section.proposalDate,
  ) || "1970-01-01T00:00:00.000Z";
  const sourceProposalVersion = input.sourceProposalVersion ||
    proposal.coreData?.immutableVersion ||
    [
      getProposalId(proposal) || canonicalSha256Hash(proposal),
      getProposalUpdatedAt(proposal) || getProposalCreatedAt(proposal) || generatedAt,
    ].filter(Boolean).join(":");
  const proposalReference = cleanString(section.proposalReference) || "";
  const selectedPackage = buildPackageSnapshot(proposal, packageRecord);
  const priorityServices = splitLines(section.priorityTreatments);
  const scope = resolveProposalV5Scope({
    packageRecord,
    proposalScopeItems: section.scopeItems || [],
  });
  const proof = (section.proofAssets || []).filter((asset) => asset.isActive !== false).map(mapProof);
  const contribution = parseMoney(section.clinicConfirmedContribution);
  const selectedMediaSpend = parseMoney(section.selectedMediaSpend || section.recommendedAdSpend || proposal.adSpendNote);
  const setupFee = selectedPackage.setupFeeCents || 0;
  const monthlyFee = selectedPackage.monthlyFeeCents || proposal.valueCents || 0;
  const canCalculateBreakEven =
    contribution !== null &&
    contribution > 0 &&
    selectedMediaSpend !== null &&
    section.contributionConfirmationState === "known" &&
    section.paybackState === "known";
  const proofReadinessMissingFields = getProposalV5ProofReadinessMissingFields({
    clinic: {
      clinicType: clinicVariant.id,
      proofTags: clinicVariant.proofTags,
    },
    proof,
  });
  const breakEvenReadinessMissingFields = [
    ...(contribution === null || contribution <= 0 ? ["economics.contribution.value"] : []),
    ...(selectedMediaSpend === null || selectedMediaSpend < 0 ? ["economics.selectedMediaSpend.value"] : []),
    ...(section.contributionConfirmationState !== "known" ? ["economics.contribution.state"] : []),
    ...(section.paybackState !== "known" ? ["economics.selectedMediaSpend.state"] : []),
    ...proofReadinessMissingFields,
  ];
  const canDisplayBreakEvenValues = canCalculateBreakEven && proofReadinessMissingFields.length === 0;

  const unsignedSnapshot: ProposalV5Snapshot = {
    schemaVersion: "proposal_v5",
    generatedAt,
    sourceProposalVersion,
    snapshotHash: "",
    pageCount: 15,
    pages: [...proposalV5PageOrder],
    proposal: {
      reference: proposalReference,
    },
    lifecycle: {
      status: getProposalStatus(proposal),
      createdAt: normalizeDate(getProposalCreatedAt(proposal)),
      issuedAt: normalizeDate(("sentAt" in proposal ? proposal.sentAt : null) || ("readyAt" in proposal ? proposal.readyAt : null)),
      expiresAt: normalizeDate(proposal.expiresAt),
      proposedStartDate: normalizeDate(proposal.startDate),
    },
    recipient: {
      name: stated(proposal.contactName || null, proposal.contactName ? "known" : "to_confirm"),
      email: stated(getContactEmail(proposal), getContactEmail(proposal) ? "known" : "to_confirm"),
      authorisedDecisionMaker: stated(proposal.contactName || null, proposal.contactName ? "known" : "to_confirm"),
    },
    clinic: {
      name: stated(proposal.clientAccountName || proposal.accountName || null, proposal.clientAccountName || proposal.accountName ? "known" : "to_confirm"),
      location: stated(section.clinicTypeAndLocations || null, section.clinicTypeAndLocations ? "working_diagnosis" : "to_confirm"),
      clinicType: clinicVariant.id,
      typeLabel: clinicVariant.label,
      typeShortLabel: clinicVariant.shortLabel,
      proofTags: clinicVariant.proofTags,
      priorityServices: stated(priorityServices, section.priorityTreatments ? "working_diagnosis" : "to_confirm"),
    },
    selectedPackage,
    commercial: {
      monthlyFeeCents: selectedPackage.monthlyFeeCents,
      setupFeeCents: selectedPackage.setupFeeCents,
      mediaSpend: stated(selectedMediaSpend, section.paybackState, section.commercialDataSource || null),
      vatStatus: selectedPackage.vatStatus,
      mediaSpendRule: selectedPackage.mediaSpendRule,
      billingFrequency: selectedPackage.billingFrequency,
      minimumTermMonths: selectedPackage.minimumTermMonths,
      noticePeriodDays: selectedPackage.noticePeriodDays,
      proposedStartDate: normalizeDate(proposal.startDate),
      expiresAt: normalizeDate(proposal.expiresAt),
    },
    discovery: {
      source: section.discoverySource || null,
      customerWording: stated(section.customerWording || null, section.evidenceConfidenceState, section.discoverySource || null, null, section.customerWording || null),
      goal: stated(section.primaryGoal || null, section.evidenceConfidenceState, section.discoverySource || null),
      whyNow: stated(section.whyActNow || null, section.evidenceConfidenceState, section.discoverySource || null),
      workingDiagnosis: stated(section.diagnosis || section.biggestRisk || null, section.evidenceConfidenceState, section.discoverySource || null),
      currentSystems: stated(section.currentWebsiteCrmBookingSetup || null, section.evidenceConfidenceState, section.discoverySource || null),
    },
    journey: {
      stages: clinicVariant.journeyStages,
      activeConstraint: stated(section.activeConstraintId || null, section.activeConstraintConfidenceState, section.discoverySource || null),
      diagnosedLeaks: stated(splitLines(section.problemsDiscussed || section.currentlyUnmeasured), section.evidenceConfidenceState, section.discoverySource || null),
      demandQuestion: clinicVariant.demandQuestion,
      progressionQuestion: clinicVariant.progressionQuestion,
      postBookingContinuation: clinicVariant.postBookingContinuation,
      clinicalBoundary: clinicVariant.clinicalBoundary,
    },
    operatingRhythm: {
      morning: clinicVariant.operatingRhythmMorning,
      weekly: "ClinicGrower and the clinic review demand, response, bookings and attendance.",
      monthly: clinicVariant.operatingRhythmMonthly,
      beforeSpend: "Choose demand, progression or neither.",
    },
    economics: {
      economicUnit: section.economicUnit || clinicVariant.terminology.economicUnit,
      contribution: stated(contribution, section.contributionConfirmationState, section.contributionEvidenceSourceDate || null),
      contributionEvidenceSourceDate: section.contributionEvidenceSourceDate || null,
      capacity: stated(parseMoney(section.availableCommercialCapacity || section.availableCapacity), section.paybackState, section.commercialDataSource || null),
      selectedMediaSpend: stated(selectedMediaSpend, section.paybackState, section.commercialDataSource || null),
      recurringBreakEvenUnits: canCalculateBreakEven ? Math.ceil((monthlyFee + selectedMediaSpend) / contribution) : null,
      firstMonthBreakEvenUnits: canCalculateBreakEven ? Math.ceil((monthlyFee + selectedMediaSpend + setupFee) / contribution) : null,
    },
    readiness: {
      breakEven: {
        canDisplayValues: canDisplayBreakEvenValues,
        state: canDisplayBreakEvenValues ? "known" : "to_confirm",
        missingFields: breakEvenReadinessMissingFields,
      },
    },
    narrative: buildNarrative({
      clinicTypeLabel: clinicVariant.label,
      priorityServices,
      currentSystems: section.currentWebsiteCrmBookingSetup || null,
      currentSystemsState: normalizeState(section.evidenceConfidenceState),
    }),
    kpis: splitLines(section.successMetrics).map((metric) => {
      const [name, baseline, source] = metric.split("|").map((part) => cleanString(part));
      return {
        name: name || metric,
        baseline: stated(baseline, baseline ? "working_diagnosis" : "to_confirm"),
        cadence: null,
        source,
      };
    }),
    scope,
    proof,
    assets: {
      sectorImages: {
        cover: mapSectorImage("cover", savedImageBySlot.get("cover"), clinicVariant.assetPack.cover),
        journey: mapSectorImage("journey", savedImageBySlot.get("journey"), clinicVariant.assetPack.journey),
        proof: mapSectorImage("proof", savedImageBySlot.get("proof"), clinicVariant.assetPack.proof),
        close: mapSectorImage("close", savedImageBySlot.get("close"), clinicVariant.assetPack.close),
      },
      osScreens: clinicVariant.osScreens,
      founderVideoThumbnail: {
        ...clinicVariant.founderVideoThumbnail,
        url: cleanString(section.introVideoThumbnailUrl) || clinicVariant.founderVideoThumbnail.url,
      },
      postBookingScreenshot: clinicVariant.postBookingScreenshot,
      implementationImage: clinicVariant.implementationImage,
    },
    links: {
      onlineProposalUrl: "proposalUrl" in proposal ? proposal.proposalUrl : null,
      acceptUrl: input.acceptanceUrl || null,
      questionUrl: input.questionUrl || null,
      videoUrl: section.introVideoUrl || section.fallbackVideoUrl || null,
      videoThumbnailUrl: cleanString(section.introVideoThumbnailUrl) || clinicVariant.founderVideoThumbnail.url,
    },
    acceptance: {
      canAccept: Boolean(input.acceptanceUrl && selectedPackage.name && proposal.expiresAt),
      lockedSnapshotHash: getAcceptanceHash(proposal),
    },
  };

  return {
    ...unsignedSnapshot,
    snapshotHash: canonicalSha256Hash(unsignedSnapshot),
  };
}
