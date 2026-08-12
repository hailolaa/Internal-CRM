import type { GrowthPackageRecord, PackageBillingFrequency } from "@/lib/api-types/packages";
import type { ProposalProofAssetRecord, ProposalRecord, ProposalScopeItem, ProposalSectionContent } from "@/lib/api-types/proposals";
import { buildProposalV5Snapshot } from "./buildProposalV5Snapshot";
import { getProposalV5ClinicTypeVariant, normaliseProposalV5ClinicTypeId, proposalV5ClinicTypeIds } from "./clinicTypeVariants";
import type { ProposalV5ClinicTypeId, ProposalV5Snapshot } from "./proposalV5Types";

const previewGeneratedAt = "2026-08-11T09:00:00.000Z";
const catalogueVersion = "clinicgrower_v5_2026_08";

type PreviewScopeItem = ProposalScopeItem & {
  description?: string;
  dependency?: string;
  owner?: string;
  exclusion?: string;
};

interface PackageFixtureInput {
  id: string;
  name: string;
  priceCents: number;
  billingFrequency: PackageBillingFrequency;
  setupFeeCents: number;
  includedFeatures: string[];
  proposalWording: string;
  mediaSpendHandling: string;
  sortOrder: number;
  scopeItems: PreviewScopeItem[];
}

interface ClinicFixture {
  clinicName: string;
  location: string;
  recipientName: string;
  recipientEmail: string;
  priorityServices: string[];
  goal: string;
  whyNow: string;
  systems: string;
  activeConstraint: string;
  economicUnit: string;
}

export interface BuildProposalV5PreviewSnapshotOptions {
  clinicType?: string | null;
  packageId?: string | null;
  longContent?: boolean;
}

const clinicFixtures: Record<ProposalV5ClinicTypeId, ClinicFixture> = {
  general: {
    clinicName: "ClinicGrower OS Review Clinic",
    location: "Multi-service private clinic in Bristol",
    recipientName: "Alex Morgan",
    recipientEmail: "alex@exampleclinic.co.uk",
    priorityServices: ["Private consultations", "Follow-up care", "Recurring patient value"],
    goal: "Create one accountable view of patient demand, response, booking and recorded value.",
    whyNow: "The clinic wants clearer evidence before adding more spend or expanding capacity.",
    systems: "Website forms, calls, booking diary and CRM notes are in use but not yet measured as one journey.",
    activeConstraint: "Evidence from enquiries to recorded value is split across separate systems.",
    economicUnit: "confirmed patient value unit",
  },
  aesthetic_clinic: {
    clinicName: "Harbourside Aesthetics Clinic",
    location: "Aesthetic clinic in Bristol",
    recipientName: "Dr Emily Carter",
    recipientEmail: "emily.carter@harboursideaesthetics.co.uk",
    priorityServices: ["Injectables", "Skin treatments", "Laser consultations"],
    goal: "Turn more high-intent treatment enquiries into attended consultations and treatment plans.",
    whyNow: "The clinic is seeing demand, but enquiry ownership and consultation follow-up are not visible enough.",
    systems: "Website forms, calls, WhatsApp enquiries and booking diary are used by the front-of-house team.",
    activeConstraint: "Treatment enquiries are not consistently tracked through consultation and treatment-plan follow-up.",
    economicUnit: "completed injectable treatment",
  },
  dental_clinic: {
    clinicName: "BristolDent Harbourside",
    location: "Private dental practice in Bristol",
    recipientName: "Dr Tanja Phillips",
    recipientEmail: "tanja@bristoldent.example",
    priorityServices: ["Dental implants", "Invisalign", "Composite bonding"],
    goal: "See which high-value enquiries become consultations, accepted plans and recorded case value.",
    whyNow: "The practice is investing in private treatment demand and needs stronger treatment-coordinator visibility.",
    systems: "Website forms, calls, dental diary and CRM notes are used, but source-to-plan value is not fully connected.",
    activeConstraint: "High-value dental enquiries reach the practice, but consultation and treatment-plan progression are not fully accountable.",
    economicUnit: "accepted implant case",
  },
  cosmetic_surgery_clinic: {
    clinicName: "Harley Surgical Clinic",
    location: "Cosmetic surgery clinic in London",
    recipientName: "Mr James Whitmore",
    recipientEmail: "james.whitmore@harleysurgical.example",
    priorityServices: ["Rhinoplasty", "Blepharoplasty", "Consultation follow-up"],
    goal: "Improve visibility from procedure enquiry to consultation, suitability review and deposit.",
    whyNow: "The clinic wants fewer unowned follow-ups across longer surgical decision cycles.",
    systems: "Website enquiries, phone calls, patient adviser notes and consultation diary are used.",
    activeConstraint: "Procedure enquiries are not always qualified, followed up and recorded through to next decision.",
    economicUnit: "booked rhinoplasty procedure",
  },
  dermatology_clinic: {
    clinicName: "Westside Dermatology Centre",
    location: "Dermatology clinic in Manchester",
    recipientName: "Dr Maya Singh",
    recipientEmail: "maya.singh@westsidederm.example",
    priorityServices: ["Skin checks", "Acne consultations", "Mole mapping"],
    goal: "Make condition-led patient demand visible from enquiry to attended private appointment.",
    whyNow: "The clinic is receiving mixed-condition demand and needs clearer routing for private care pathways.",
    systems: "Website service pages, calls, patient-services notes and booking diary are used.",
    activeConstraint: "Condition-led demand is not consistently tied to source, appointment attendance and follow-up.",
    economicUnit: "attended new-patient appointment",
  },
  hair_transplant_clinic: {
    clinicName: "Northgate Hair Restoration",
    location: "Hair transplant clinic in Leeds",
    recipientName: "Mr Daniel Reed",
    recipientEmail: "daniel.reed@northgatehair.example",
    priorityServices: ["FUE consultations", "Quote follow-up", "Procedure deposits"],
    goal: "Track research-stage demand through assessment, quote follow-up and procedure booking.",
    whyNow: "The clinic wants better ownership across longer enquiry-to-deposit decisions.",
    systems: "Website enquiries, calls, patient adviser notes and assessment diary are used.",
    activeConstraint: "Hair restoration leads need clearer nurture, assessment ownership and deposit follow-up.",
    economicUnit: "booked FUE procedure",
  },
  wellness_clinic: {
    clinicName: "HVN Wellness Clinic",
    location: "Wellness clinic in London",
    recipientName: "Sophie Lane",
    recipientEmail: "sophie.lane@hvnwellness.example",
    priorityServices: ["Longevity programmes", "Discovery calls", "Membership renewal"],
    goal: "Show whether education-led demand becomes discovery calls, programme starts and renewal opportunities.",
    whyNow: "The clinic needs clearer evidence before expanding programme demand and recurring care.",
    systems: "Website enquiries, discovery calls, booking diary and programme notes are used.",
    activeConstraint: "Programme interest is not always visible through consultation, enrolment and renewal.",
    economicUnit: "weight-management programme enrolment",
  },
  private_gp_medical_clinic: {
    clinicName: "City Private Medical",
    location: "Private GP and medical clinic in Birmingham",
    recipientName: "Dr Olivia Grant",
    recipientEmail: "olivia.grant@cityprivatemedical.example",
    priorityServices: ["Private GP appointments", "Health checks", "Screening enquiries"],
    goal: "Make private medical demand visible from service search to attended appointment and follow-up.",
    whyNow: "The clinic wants better evidence around demand, clinician capacity and service-line value.",
    systems: "Website, calls, booking diary and medical secretary notes are used.",
    activeConstraint: "Private appointment demand is not consistently linked to source, attendance and recorded service value.",
    economicUnit: "attended private GP appointment",
  },
  medical_spa: {
    clinicName: "Aura Medical Spa",
    location: "Medical spa in Cheltenham",
    recipientName: "Rebecca Stone",
    recipientEmail: "rebecca.stone@auramedspa.example",
    priorityServices: ["Skin rejuvenation", "Laser packages", "Membership follow-up"],
    goal: "Improve visibility from treatment interest to consultation, plan acceptance and repeat value.",
    whyNow: "The clinic wants clearer follow-up ownership before increasing treatment-package demand.",
    systems: "Website forms, calls, treatment booking diary and membership notes are used.",
    activeConstraint: "Premium treatment enquiries are not always tracked through plan acceptance and repeat-booking follow-up.",
    economicUnit: "accepted skin-rejuvenation treatment plan",
  },
};

function scopeItem({
  category,
  title,
  description,
  frequency,
  quantityLimit,
  treatmentsAndLocations,
  dependency,
  owner,
  exclusion,
  thirdPartyCosts,
  sortOrder,
  deliveryType = "recurring",
}: {
  category: string;
  title: string;
  description: string;
  frequency: string;
  quantityLimit: string;
  treatmentsAndLocations: string;
  dependency: string;
  owner: string;
  exclusion: string;
  thirdPartyCosts: string;
  sortOrder: number;
  deliveryType?: "recurring" | "one_off";
}): PreviewScopeItem {
  return {
    category,
    title,
    clientDescription: description,
    description,
    frequency,
    quantityLimit,
    treatmentsAndLocations,
    dependencies: dependency,
    dependency,
    clientResponsibilities: owner,
    owner,
    exclusions: exclusion,
    exclusion,
    thirdPartyCosts,
    inclusionStatus: "included",
    deliveryType,
    isOptionalAddOn: false,
    approvalStatus: "not_required",
    sortOrder,
  };
}

function makePackage(input: PackageFixtureInput): GrowthPackageRecord {
  return {
    id: input.id,
    name: input.name,
    priceCents: input.priceCents,
    currency: "GBP",
    billingFrequency: input.billingFrequency,
    setupFeeCents: input.setupFeeCents,
    includedFeatures: input.includedFeatures,
    internalNotes: "Internal V5 preview fixture. Production proposals use the saved package catalogue record.",
    proposalWording: input.proposalWording,
    sortOrder: input.sortOrder,
    status: "active",
    isDefault: true,
    catalogueVersion,
    commercialNotes: {
      mediaSpendHandling: input.mediaSpendHandling,
      contractTermSource: "Selected term must be explicitly stored on the issued proposal.",
      vatHandling: "ClinicGrower fees/setup and platform media tax/VAT treatment are separate fields.",
      pricingSource: "V5 package catalogue.",
      v5ScopeItems: input.scopeItems,
    },
    createdAt: previewGeneratedAt,
    updatedAt: previewGeneratedAt,
  };
}

export const proposalV5PreviewPackages: GrowthPackageRecord[] = [
  makePackage({
    id: "free-clinic-growth-audit",
    name: "Free Clinic Growth Audit",
    priceCents: 0,
    billingFrequency: "one_off",
    setupFeeCents: 0,
    includedFeatures: ["Outside-in growth audit", "Clinic journey review", "Priority recommendations"],
    proposalWording: "Free Clinic Growth Audit identifies the first commercial gaps to verify before paid work starts.",
    mediaSpendHandling: "No paid media included.",
    sortOrder: 10,
    scopeItems: [
      scopeItem({
        category: "Audit",
        title: "Outside-in growth audit",
        description: "Review the public clinic journey and identify the first commercial gaps to verify.",
        frequency: "One-off",
        quantityLimit: "One clinic journey",
        treatmentsAndLocations: "Selected clinic services and locations reviewed from public information",
        dependency: "Public website, source context and decision-maker input",
        owner: "Provide public clinic context and decision-maker input.",
        exclusion: "Connected ClinicGrower OS data, paid media management and implementation delivery",
        thirdPartyCosts: "No paid media included.",
        sortOrder: 10,
        deliveryType: "one_off",
      }),
    ],
  }),
  makePackage({
    id: "growth-diagnostic",
    name: "Growth Diagnostic",
    priceCents: 39_500,
    billingFrequency: "monthly",
    setupFeeCents: 0,
    includedFeatures: ["Diagnostic review", "Journey gap diagnosis", "Monthly priority recommendations"],
    proposalWording: "Growth Diagnostic gives the clinic a focused monthly view of the commercial gaps holding back enquiries, bookings and recorded value.",
    mediaSpendHandling: "Media spend is separate from the ClinicGrower fee.",
    sortOrder: 20,
    scopeItems: [
      scopeItem({
        category: "Diagnosis",
        title: "Monthly diagnostic and priority recommendations",
        description: "Diagnose the commercial gaps holding back enquiries, bookings and recorded value.",
        frequency: "Monthly",
        quantityLimit: "One priority journey",
        treatmentsAndLocations: "Selected services and locations confirmed in discovery",
        dependency: "Confirmed access and source data",
        owner: "Confirm source access and attend the review cadence.",
        exclusion: "Managed media, delivery execution and custom reporting builds",
        thirdPartyCosts: "Paid media and third-party tools remain separate.",
        sortOrder: 10,
      }),
    ],
  }),
  makePackage({
    id: "lead-concierge",
    name: "Lead Concierge",
    priceCents: 59_500,
    billingFrequency: "monthly",
    setupFeeCents: 0,
    includedFeatures: ["Lead handling visibility", "Response ownership", "Follow-up accountability"],
    proposalWording: "Lead Concierge helps the clinic protect valuable enquiries by making response ownership and follow-up visible.",
    mediaSpendHandling: "Media spend is separate from the ClinicGrower fee.",
    sortOrder: 30,
    scopeItems: [
      scopeItem({
        category: "Lead Handling",
        title: "Lead response ownership and follow-up visibility",
        description: "Make response ownership, overdue follow-up and next actions visible for valuable enquiries.",
        frequency: "Weekly",
        quantityLimit: "One lead-handling journey",
        treatmentsAndLocations: "Selected priority services confirmed in discovery",
        dependency: "Enquiry source access and agreed response standard",
        owner: "Confirm enquiry handling owners and response standards.",
        exclusion: "New website builds, paid media management and outsourced reception",
        thirdPartyCosts: "Messaging, phone and provider costs remain separate.",
        sortOrder: 10,
      }),
    ],
  }),
  makePackage({
    id: "starter-engine",
    name: "Starter Engine",
    priceCents: 99_500,
    billingFrequency: "monthly",
    setupFeeCents: 0,
    includedFeatures: ["Starter growth operating rhythm", "Priority journey visibility", "Reporting cadence"],
    proposalWording: "Starter Engine gives the clinic a lighter ClinicGrower OS-powered operating rhythm for the first priority journey.",
    mediaSpendHandling: "Agreed ad spend is separate and paid directly to the selected platform with no ClinicGrower markup.",
    sortOrder: 40,
    scopeItems: [
      scopeItem({
        category: "ClinicGrower OS",
        title: "Starter growth operating rhythm",
        description: "Establish a lighter operating rhythm around one priority journey.",
        frequency: "Monthly with weekly exceptions",
        quantityLimit: "One priority journey",
        treatmentsAndLocations: "Selected clinic service journey",
        dependency: "Tracking access and agreed owner responsibilities",
        owner: "Approve the first priority journey and provide tracking access.",
        exclusion: "Multi-location delivery, custom integrations and expanded campaign sets",
        thirdPartyCosts: "Paid media and third-party tools remain separate.",
        sortOrder: 10,
      }),
    ],
  }),
  makePackage({
    id: "growth-partner",
    name: "Growth Partner",
    priceCents: 169_500,
    billingFrequency: "monthly",
    setupFeeCents: 0,
    includedFeatures: ["Growth accountability layer", "Journey optimisation", "Monthly action rhythm"],
    proposalWording: "Growth Partner adds a broader accountability layer around the clinic journey, response ownership and growth priorities.",
    mediaSpendHandling: "Agreed ad spend is separate and paid directly to the selected platform with no ClinicGrower markup.",
    sortOrder: 50,
    scopeItems: [
      scopeItem({
        category: "Growth Management",
        title: "Growth accountability layer",
        description: "Operate the clinic journey, response ownership and growth priorities through a broader accountability rhythm.",
        frequency: "Monthly strategy with weekly exceptions",
        quantityLimit: "Approved priority journey set",
        treatmentsAndLocations: "Selected priority services and locations",
        dependency: "Source access, claims approval and clinic-side ownership",
        owner: "Approve journey priorities, claims and clinic-side actions.",
        exclusion: "Additional locations, bespoke development and unsupported data sources",
        thirdPartyCosts: "Paid media and third-party tools remain separate.",
        sortOrder: 10,
      }),
    ],
  }),
  makePackage({
    id: "clinic-growth-engine",
    name: "Clinic Growth Engine",
    priceCents: 249_500,
    billingFrequency: "monthly",
    setupFeeCents: 99_500,
    includedFeatures: ["ClinicGrower OS commercial layer", "90-day implementation period", "Journey, proof and operating rhythm"],
    proposalWording: "Clinic Growth Engine is the recommended ClinicGrower OS-powered programme for turning patient demand into visible, accountable progression and recorded value.",
    mediaSpendHandling: "Example selected monthly paid media is GBP 3,000 paid directly to the selected platform with no ClinicGrower markup.",
    sortOrder: 60,
    scopeItems: [
      scopeItem({
        category: "ClinicGrower OS",
        title: "ClinicGrower OS commercial layer",
        description: "Turn patient demand into visible, accountable progression and recorded value for the selected journey.",
        frequency: "90-day implementation, weekly exceptions and monthly strategy",
        quantityLimit: "One selected commercial operating journey",
        treatmentsAndLocations: "Priority services and locations selected in discovery",
        dependency: "Source access, media approval, capacity confirmation and human review",
        owner: "Provide source access, approve media claims and confirm capacity.",
        exclusion: "Photography, outsourced reception, new websites and unapproved service lines",
        thirdPartyCosts: "Selected platform media and third-party tools remain separate.",
        sortOrder: 10,
      }),
    ],
  }),
  makePackage({
    id: "growth-engine-plus",
    name: "Growth Engine Plus",
    priceCents: 349_500,
    billingFrequency: "monthly",
    setupFeeCents: 99_500,
    includedFeatures: ["Expanded ClinicGrower OS operating layer", "Multi-journey accountability", "Advanced optimisation rhythm"],
    proposalWording: "Growth Engine Plus expands the ClinicGrower OS accountability layer across more journeys, service lines or locations where approved.",
    mediaSpendHandling: "Agreed ad spend is separate and paid directly to the selected platform with no ClinicGrower markup.",
    sortOrder: 70,
    scopeItems: [
      scopeItem({
        category: "Expanded ClinicGrower OS",
        title: "Expanded multi-journey ClinicGrower OS layer",
        description: "Extend the operating layer across more journeys, service lines or locations where approved.",
        frequency: "90-day implementation, weekly exceptions and monthly strategy",
        quantityLimit: "Approved multi-journey scope",
        treatmentsAndLocations: "Approved service lines and locations only",
        dependency: "Source access, journey owners and approved data connections",
        owner: "Confirm owners for each approved journey and provide access.",
        exclusion: "Unscoped locations, unsupported integrations and separate creative production",
        thirdPartyCosts: "Selected platform media and third-party tools remain separate.",
        sortOrder: 10,
      }),
    ],
  }),
  makePackage({
    id: "market-leader",
    name: "Market Leader",
    priceCents: 499_500,
    billingFrequency: "monthly",
    setupFeeCents: 99_500,
    includedFeatures: ["Market leadership operating system", "Advanced multi-channel growth accountability", "Senior strategy rhythm"],
    proposalWording: "Market Leader is the senior ClinicGrower OS growth partnership for clinics ready to lead a market with stronger visibility and accountability.",
    mediaSpendHandling: "Agreed ad spend is separate and paid directly to the selected platform with no ClinicGrower markup.",
    sortOrder: 80,
    scopeItems: [
      scopeItem({
        category: "Market Leadership",
        title: "Senior market leadership operating system",
        description: "Run a senior operating rhythm for clinics ready to lead a market with stronger visibility and accountability.",
        frequency: "Senior strategy cadence with weekly exceptions",
        quantityLimit: "Approved market leadership scope",
        treatmentsAndLocations: "Approved markets, service lines and locations",
        dependency: "Senior decision-maker access, source data and approved market priorities",
        owner: "Approve senior strategy decisions, access and market priorities.",
        exclusion: "Unapproved markets, third-party tools and media spend",
        thirdPartyCosts: "Selected platform media and third-party tools remain separate.",
        sortOrder: 10,
      }),
    ],
  }),
];

export const proposalV5PreviewPackageIds = proposalV5PreviewPackages.map((item) => item.id);

function selectedPackage(packageId: string | null | undefined): GrowthPackageRecord {
  const normalized = String(packageId || "").trim().toLowerCase();
  return (
    proposalV5PreviewPackages.find((item) => item.id === normalized || item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") === normalized) ||
    proposalV5PreviewPackages.find((item) => item.id === "clinic-growth-engine") ||
    proposalV5PreviewPackages[0]
  );
}

function longContentScopeItem(fixture: ClinicFixture): PreviewScopeItem {
  return scopeItem({
    category: "Long-content validation",
    title: "Extended responsibility and dependency line for browser overflow validation",
    description:
      "This deliberately long line checks that the V5 preview can carry detailed approved scope wording without clipping, hidden table text or accidental page expansion.",
    frequency: "Weekly exceptions, monthly commercial review and a documented checkpoint before material spend changes",
    quantityLimit: "One selected commercial journey across the agreed priority services and the confirmed clinic location set",
    treatmentsAndLocations: `${fixture.priorityServices.join(", ")} across ${fixture.location}`,
    dependency:
      "Named clinic owner, confirmed source access, approved claims, confirmed capacity, enquiry ownership and human review boundaries.",
    owner:
      "Provide access promptly, confirm clinical and commercial claims, attend the review rhythm and approve material scope changes before work proceeds.",
    exclusion:
      "Unapproved service lines, unapproved locations, unsupported integrations, outsourced reception, clinical advice and new creative production.",
    thirdPartyCosts: "Platform media, third-party software, tracking providers and licensed media costs remain separate unless written into the accepted scope.",
    sortOrder: 99,
  });
}

function packageForPreview(packageId: string | null | undefined, fixture: ClinicFixture, longContent: boolean): GrowthPackageRecord {
  const packageRecord = selectedPackage(packageId);
  if (!longContent) return packageRecord;
  const notes = packageRecord.commercialNotes || {};
  const scopeItems = Array.isArray(notes.v5ScopeItems) ? notes.v5ScopeItems : [];

  return {
    ...packageRecord,
    commercialNotes: {
      ...notes,
      v5ScopeItems: [...scopeItems, longContentScopeItem(fixture)],
    },
  };
}

function proofTagFor(clinicType: ProposalV5ClinicTypeId) {
  const variant = getProposalV5ClinicTypeVariant(clinicType);
  return variant.proofTags[0] || variant.id;
}

function proofAssetsFor(clinicType: ProposalV5ClinicTypeId, longContent: boolean): ProposalProofAssetRecord[] {
  const variant = getProposalV5ClinicTypeVariant(clinicType);
  const tag = proofTagFor(clinicType);
  const proofScope = `${variant.shortLabel} matched managed-marketing evidence; ClinicGrower OS outcomes depend on connected data and accepted scope.`;
  const disclaimer = longContent
    ? "Historical managed-marketing proof is shown for context only. It is not a ClinicGrower OS guarantee, does not promise an identical outcome, and must be read alongside the selected package scope, data dependencies and commercial terms."
    : "Historical managed-marketing proof is not a ClinicGrower OS guarantee.";
  const sourceTags = [
    tag,
    "state:known",
    `proof_scope:${proofScope}`,
    "source:ClinicGrower approved proof library",
    "timeframe:Documented delivery period",
    `disclaimer:${disclaimer}`,
  ];

  return [
    {
      id: `${clinicType}-proof-001`,
      type: "performance_result",
      title: "+262.73%",
      copy: "Increase in high-intent enquiries after managed marketing work was reviewed against source reporting.",
      mediaUrl: null,
      sectorTags: sourceTags,
      sortOrder: 10,
      isActive: true,
      createdAt: previewGeneratedAt,
      updatedAt: previewGeneratedAt,
    },
    {
      id: `${clinicType}-proof-002`,
      type: "performance_result",
      title: "-31.41%",
      copy: "Reduction in cost per enquiry after campaign and conversion work was tightened.",
      mediaUrl: null,
      sectorTags: sourceTags,
      sortOrder: 20,
      isActive: true,
      createdAt: previewGeneratedAt,
      updatedAt: previewGeneratedAt,
    },
    {
      id: `${clinicType}-proof-003`,
      type: "performance_result",
      title: "+100.6%",
      copy: "Increase in qualified consultation demand where campaign context and delivery inputs were recorded.",
      mediaUrl: null,
      sectorTags: sourceTags,
      sortOrder: 30,
      isActive: true,
      createdAt: previewGeneratedAt,
      updatedAt: previewGeneratedAt,
    },
    {
      id: `${clinicType}-testimonial-001`,
      type: "testimonial",
      title: "Dr Tanja Phillips, approved ClinicGrower proof asset",
      copy: "ClinicGrower gave us clearer visibility over where demand was coming from and what needed attention first.",
      mediaUrl: "/brand/proof/tanja-phillips.webp",
      sectorTags: [
        tag,
        "state:known",
        "source:ClinicGrower approved testimonial library",
        "timeframe:Permissioned testimonial",
        "disclaimer:Named testimonial is used only where permission exists.",
      ],
      sortOrder: 40,
      isActive: true,
      createdAt: previewGeneratedAt,
      updatedAt: previewGeneratedAt,
    },
    {
      id: `${clinicType}-video-001`,
      type: "testimonial_video",
      title: `${variant.shortLabel} owner proof video`,
      copy: "Selected video proof for reviewing the ClinicGrower recommendation in context.",
      mediaUrl: variant.founderVideoThumbnail.url,
      sectorTags: [
        tag,
        "state:known",
        "source:ClinicGrower approved video library",
        "timeframe:Permissioned video asset",
        "disclaimer:Video proof is contextual and is not a guaranteed outcome.",
      ],
      sortOrder: 50,
      isActive: true,
      createdAt: previewGeneratedAt,
      updatedAt: previewGeneratedAt,
    },
    {
      id: `${clinicType}-case-study-001`,
      type: "case_study",
      title: `${variant.shortLabel} matched case study`,
      copy: `A relevant ${variant.label.toLowerCase()} case study selected for the proposal review.`,
      mediaUrl: variant.assetPack.proof.url,
      sectorTags: [
        tag,
        "state:known",
        "source:ClinicGrower approved case-study library",
        "timeframe:Documented delivery period",
        "disclaimer:Case-study evidence is contextual and does not imply a guaranteed outcome.",
      ],
      sortOrder: 60,
      isActive: true,
      createdAt: previewGeneratedAt,
      updatedAt: previewGeneratedAt,
    },
    {
      id: `${clinicType}-product-screenshot-001`,
      type: "product_screenshot",
      title: "ClinicGrower OS growth visibility screenshot",
      copy: "ClinicGrower OS screenshot showing the visibility and accountability layer where connected sources are available.",
      mediaUrl: variant.osScreens[0]?.url || null,
      sectorTags: [
        tag,
        "clinicgrower os",
        "product screenshot",
        "state:known",
        "source:ClinicGrower OS product screenshot library",
        "timeframe:Current V5 product reference",
        "disclaimer:Product screenshot is illustrative of ClinicGrower OS visibility where supported sources are connected.",
      ],
      sortOrder: 65,
      isActive: true,
      createdAt: previewGeneratedAt,
      updatedAt: previewGeneratedAt,
    },
    {
      id: `${clinicType}-award-001`,
      type: "award",
      title: "Aesthetics Awards 2025 Highly Commended",
      copy: "ClinicGrower proof credential selected for proposal credibility.",
      mediaUrl: "/brand/proof/aesthetic-awards-highly-commended-2025.webp",
      sectorTags: [
        tag,
        "state:known",
        "source:ClinicGrower proof library",
        "timeframe:2025",
        "disclaimer:Award recognition is a credibility signal, not a performance guarantee.",
      ],
      sortOrder: 70,
      isActive: true,
      createdAt: previewGeneratedAt,
      updatedAt: previewGeneratedAt,
    },
    {
      id: `${clinicType}-award-002`,
      type: "award",
      title: "2026 Best Service or Solution Provider Finalist",
      copy: "ClinicGrower proof credential selected for proposal credibility.",
      mediaUrl: null,
      sectorTags: [
        tag,
        "state:known",
        "source:ClinicGrower proof library",
        "timeframe:2026",
        "disclaimer:Award recognition is a credibility signal, not a performance guarantee.",
      ],
      sortOrder: 80,
      isActive: true,
      createdAt: previewGeneratedAt,
      updatedAt: previewGeneratedAt,
    },
  ];
}

function sectionForPreview(clinicType: ProposalV5ClinicTypeId, fixture: ClinicFixture, longContent: boolean): ProposalSectionContent {
  const variant = getProposalV5ClinicTypeVariant(clinicType);
  const priorityServices = longContent
    ? [
        ...fixture.priorityServices,
        "long wording validation for treatment, location and commercial journey wrapping",
      ]
    : fixture.priorityServices;

  return {
    proposalReference: "CG-V5-PREVIEW-001",
    proposalDate: "2026-08-11",
    clinicTypeVariant: clinicType,
    clinicTypeAssetVersion: "2026-08-10.v5-approved-assets",
    discoverySource: "Discovery call",
    customerWording: longContent
      ? "The clinic owner wants the decision to be based on the real patient journey, not separate reports that make marketing, reception, booking and revenue look disconnected."
      : "The clinic owner wants clearer visibility of the patient journey and the first constraint to fix.",
    evidenceConfidenceState: "known",
    activeConstraintId: variant.journeyStages[2] || fixture.activeConstraint,
    activeConstraintConfidenceState: "working_diagnosis",
    economicUnit: fixture.economicUnit,
    clinicConfirmedContribution: "3000",
    contributionEvidenceSourceDate: "2026-08-11",
    contributionConfirmationState: "known",
    selectedMediaSpend: "3000",
    paybackState: "known",
    liveDataStatus: "partially_connected",
    knownDataLimitations: "Current proposal preview uses discovery and approved asset data; connected live data depends on accepted scope and provider access.",
    executiveSummary: "ClinicGrower OS is recommended as the commercial accountability layer for the selected priority journey.",
    personalIntroduction: "This proposal has been prepared around the clinic's priority journey, current measurement gaps and the next decisions needed before more demand is scaled.",
    diagnosis: fixture.activeConstraint,
    introVideoUrl: "https://vimeo.com/1008757315",
    introVideoTitle: "ClinicGrower OS founder walkthrough",
    primaryGoal: fixture.goal,
    clinicTypeAndLocations: longContent ? `${fixture.location} with a deliberately long location label for A4 browser wrapping validation` : fixture.location,
    currentPosition: "Demand exists, but the journey from enquiry to recorded value is not measured as one accountable commercial path.",
    currentMarketingSpend: "GBP 3,000 selected media spend for preview validation",
    currentWebsiteCrmBookingSetup: fixture.systems,
    problemsDiscussed: [fixture.activeConstraint, ...variant.painExamples].join("; "),
    whyActNow: fixture.whyNow,
    currentlyUnmeasured: "Response ownership, booking progression, attended consultation outcomes and recorded value where systems are not connected.",
    availableCapacity: "6",
    availableCommercialCapacity: "6",
    priorityTreatments: priorityServices.join("; "),
    targetArea: variant.shortLabel,
    desiredOutcome: fixture.goal,
    currentMonthlyEnquiries: "80",
    currentMonthlyBookedPatients: "28",
    currentBookingRate: "35%",
    attendanceRate: "78%",
    consultationToTreatmentConversionRate: "42%",
    targetBookings: "40",
    consultationValue: "3000",
    averageTreatmentValue: "3000",
    currentAcquisitionCost: "185",
    recommendedAdSpend: "3000",
    estimatedCostPerLead: "150",
    estimatedLeads: "20",
    estimatedBookedPatients: "7",
    breakEvenBookings: "2",
    commercialDataSource: "Discovery call and preliminary outside-in review",
    recommendedPlan: "Use ClinicGrower OS to verify the first constraint, assign ownership and review the priority journey before scaling spend.",
    proofAssets: proofAssetsFor(clinicType, longContent),
    successMetrics: [
      "Response time|Not currently measured|Call and enquiry source where connected",
      "Booked consultation rate|Working diagnosis|CRM and booking diary where connected",
      "Accepted value|Provisional|Finance and treatment-plan source where connected",
    ],
    clinicGrowerResponsibilities: [
      "Operate the accepted ClinicGrower OS commercial layer.",
      "Review source, journey and follow-up evidence where connected.",
      longContent
        ? "Document material changes, keep human review in place and escalate data limitations before recommendations are treated as confirmed."
        : "Keep human review in place before material recommendations.",
    ],
    clientResponsibilities: [
      "Provide source access and approve clinic claims.",
      "Confirm capacity, owner responsibilities and clinical boundaries.",
      longContent
        ? "Review scope, term, media-spend assumptions and accepted responsibilities before approval."
        : "Review scope and accepted responsibilities before approval.",
    ],
    timeline: "Days 1-14 baseline; day 30 first leak; day 60 decision review; day 90 scale, hold or change route.",
    termsSummary: "Monthly fee plus VAT, setup plus VAT where selected, media spend separate, six-month minimum term and 30-day notice after the initial term.",
    investmentNotes: "Selected media spend is paid directly to the platform and remains separate from the ClinicGrower fee.",
    nextSteps: "Approve the recommendation online or ask a question before the expiry date.",
  };
}

function proposalForPreview(
  clinicType: ProposalV5ClinicTypeId,
  packageRecord: GrowthPackageRecord,
  fixture: ClinicFixture,
  longContent: boolean,
): ProposalRecord {
  const clinicName = longContent
    ? `${fixture.clinicName} Advanced Patient Journey and Commercial Accountability Review`
    : fixture.clinicName;

  return {
    id: "v5-private-preview",
    contactId: "preview-contact",
    dealId: "preview-deal",
    clientAccountProfileId: "preview-client-account",
    proposalName: `Personalised Growth Proposal for ${clinicName}`,
    templateKey: "clinicgrower_v5",
    packageName: packageRecord.name,
    recommendedPackageId: packageRecord.id,
    ownerId: "preview-owner",
    ownerName: "Max Sharpe",
    status: "ready",
    valueCents: packageRecord.priceCents,
    monthlyFeeCents: packageRecord.priceCents,
    setupFeeCents: packageRecord.setupFeeCents,
    currency: packageRecord.currency,
    adSpendNote: "Selected media spend is paid directly to the platform and remains separate from the ClinicGrower fee.",
    vatStatus: "plus_vat",
    minimumTermMonths: 6,
    noticePeriodDays: 30,
    startDate: "2026-09-01",
    followUpAt: null,
    readyAt: "2026-08-11T09:15:00.000Z",
    sentAt: null,
    sentToEmail: fixture.recipientEmail,
    sentToName: fixture.recipientName,
    sendMethod: null,
    sendNote: null,
    sentBy: null,
    sentByName: null,
    viewedAt: null,
    acceptedAt: null,
    acceptedReason: null,
    wonAt: null,
    wonReason: null,
    lostAt: null,
    lostReason: null,
    objectionType: null,
    expiresAt: "2026-09-30T23:59:59.000Z",
    proposalUrl: null,
    notes: null,
    addOns: [],
    discounts: [],
    internalMarginNote: null,
    sectionContent: sectionForPreview(clinicType, fixture, longContent),
    coreData: null,
    draftSavedAt: null,
    contactName: fixture.recipientName,
    contactEmail: fixture.recipientEmail,
    accountName: clinicName,
    dealTitle: `${clinicName} - ${packageRecord.name}`,
    clientAccountName: clinicName,
    createdBy: "preview-owner",
    updatedBy: "preview-owner",
    createdAt: previewGeneratedAt,
    updatedAt: previewGeneratedAt,
    acceptanceRecord: null,
  };
}

export function buildProposalV5PreviewSnapshot({
  clinicType: clinicTypeInput,
  packageId,
  longContent = false,
}: BuildProposalV5PreviewSnapshotOptions = {}): ProposalV5Snapshot {
  const clinicType = normaliseProposalV5ClinicTypeId(clinicTypeInput);
  const fixture = clinicFixtures[clinicType];
  const packageRecord = packageForPreview(packageId, fixture, longContent);
  const proposal = proposalForPreview(clinicType, packageRecord, fixture, longContent);

  return buildProposalV5Snapshot({
    proposal,
    packageRecord,
    generatedAt: previewGeneratedAt,
    sourceProposalVersion: `private-preview:${clinicType}:${packageRecord.id}:${longContent ? "long" : "standard"}`,
    acceptanceUrl: "#accept-preview",
    questionUrl: "mailto:hello@clinicgrower.co.uk?subject=ClinicGrower%20OS%20proposal%20question",
  });
}

export function getProposalV5PreviewAssetUrls(snapshot: ProposalV5Snapshot) {
  const urls = new Set<string>();
  urls.add("/brand/clinic-grower-logo-inline.png");
  urls.add("/brand/proposal/v5-reference/aesthetic_clinics/p01-img01-6781x1322.png");

  Object.values(snapshot.assets.sectorImages).forEach((image) => {
    if (image.url) urls.add(image.url);
  });
  snapshot.assets.osScreens.forEach((image) => {
    if (image.url) urls.add(image.url);
  });
  if (snapshot.assets.founderVideoThumbnail?.url) urls.add(snapshot.assets.founderVideoThumbnail.url);
  if (snapshot.assets.postBookingScreenshot?.url) urls.add(snapshot.assets.postBookingScreenshot.url);
  if (snapshot.assets.implementationImage?.url) urls.add(snapshot.assets.implementationImage.url);
  snapshot.proof.forEach((asset) => {
    if (asset.mediaUrl?.startsWith("/brand/")) urls.add(asset.mediaUrl);
  });

  return [...urls].sort();
}

export function listProposalV5PreviewClinicTypes() {
  return proposalV5ClinicTypeIds.filter((id) => id !== "general");
}
