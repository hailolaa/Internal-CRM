import { createElement } from "react";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { GrowthPackageRecord } from "@/lib/api-types/packages";
import type { ProposalPublicRecord } from "@/lib/api-types/proposals";
import { calculateProposalV5BreakEven } from "./data/breakEven";
import { buildProposalV5Snapshot } from "./data/buildProposalV5Snapshot";
import { proposalV5ClinicTypeIds } from "./data/clinicTypeVariants";
import { getPackageProposalV5Scope } from "./data/packageScope";
import { getProposalV5ProofReadinessMissingFields } from "./data/proofValidation";
import { proposalV5Tokens } from "./design/proposalV5Tokens";
import { isProposalV5PublicSnapshot, ProposalV5Renderer } from "./renderer/ProposalV5Renderer";
import { proposalV5PageOrder } from "./pages/pageOrder";
import { proposalV5PageRegistry, validateProposalV5PageRegistry } from "./pages/registry";
import { getV5Page01MissingFields, V5Page01Cover } from "./pages/V5Page01Cover";
import { getV5Page02MissingFields, V5Page02EvidenceQuestions } from "./pages/V5Page02EvidenceQuestions";
import { getV5Page03MissingFields, V5Page03EvidenceTrail } from "./pages/V5Page03EvidenceTrail";
import { getV5Page04MissingFields, V5Page04CommercialDiagnosis } from "./pages/V5Page04CommercialDiagnosis";
import { getV5Page05MissingFields, V5Page05PartnerProposition } from "./pages/V5Page05PartnerProposition";
import { getV5Page06MissingFields, V5Page06SystemsFit } from "./pages/V5Page06SystemsFit";
import { getV5Page07MissingFields, V5Page07DemandProgression } from "./pages/V5Page07DemandProgression";
import { getV5Page08MissingFields, V5Page08ResponseOwnership } from "./pages/V5Page08ResponseOwnership";
import { getV5Page09MissingFields, V5Page09PostBooking } from "./pages/V5Page09PostBooking";
import { getV5Page10MissingFields, V5Page10CommercialAccountability } from "./pages/V5Page10CommercialAccountability";
import { getV5Page11MissingFields, V5Page11OSCapability } from "./pages/V5Page11OSCapability";
import { getV5Page12MissingFields, V5Page12BreakEven } from "./pages/V5Page12BreakEven";
import { getV5Page13MissingFields, V5Page13Implementation } from "./pages/V5Page13Implementation";
import { getV5Page14MissingFields, V5Page14OperatingRhythm } from "./pages/V5Page14OperatingRhythm";
import { getV5Page15MissingFields, V5Page15ScopeMatrix } from "./pages/V5Page15ScopeMatrix";
import { getV5Page16MissingFields, V5Page16Responsibilities } from "./pages/V5Page16Responsibilities";
import { getV5Page17MissingFields, V5Page17Proof } from "./pages/V5Page17Proof";
import { getV5Page18MissingFields, V5Page18Investment } from "./pages/V5Page18Investment";
import { getV5Page19MissingFields, V5Page19Close } from "./pages/V5Page19Close";

const baseProposal: ProposalPublicRecord = {
  proposalName: "V5 foundation proposal",
  templateKey: "clinicgrower_v5",
  packageName: "Performance OS",
  valueCents: 99_500,
  monthlyFeeCents: 99_500,
  setupFeeCents: 0,
  currency: "GBP",
  adSpendNote: "Separate media spend value supplied by the proposal data.",
  vatStatus: "plus_vat",
  minimumTermMonths: 6,
  noticePeriodDays: 30,
  startDate: "2026-09-01",
  expiresAt: "2026-09-30T23:59:59.000Z",
  addOns: [],
  discounts: [],
  sectionContent: {
    proposalReference: "CG-V5-TEST-001",
    clinicTypeVariant: "dental_clinic",
    discoverySource: "Discovery call",
    customerWording: "Owner wording captured in source data.",
    evidenceConfidenceState: "known",
    primaryGoal: "Known source goal.",
    whyActNow: "Known source timing.",
    diagnosis: "Known source diagnosis.",
    currentWebsiteCrmBookingSetup: "Known source systems.",
    clinicTypeAndLocations: "Bristol private dental practice",
    introVideoUrl: "https://vimeo.com/1008757315",
    priorityTreatments: "Implants; Invisalign; Composite bonding",
    activeConstraintId: "Treatment-coordinator review",
    activeConstraintConfidenceState: "working_diagnosis",
    problemsDiscussed:
      "Lead handling|High-value enquiries can be lost between first contact and coordinator follow-up.; Attendance|Booked assessments do not reliably become attended consultations.; Case value|Marketing source is disconnected from accepted treatment-plan value.",
    economicUnit: "accepted implant case",
    clinicConfirmedContribution: "3000",
    contributionEvidenceSourceDate: "2026-08-10",
    contributionConfirmationState: "known",
    selectedMediaSpend: "1500",
    paybackState: "known",
    availableCommercialCapacity: "6",
    commercialDataSource: "Discovery call",
    successMetrics: ["Response time|Not currently measured|CRM"],
    scopeItems: [
      {
        category: "Tracking",
        title: "Performance-led growth management",
        clientDescription: "Stored growth-management scope wording supplied by proposal data.",
        frequency: "Kickoff; weekly exceptions; monthly strategy",
        quantityLimit: "One priority journey",
        treatmentsAndLocations: "Implants, Invisalign and composite bonding for the Bristol practice",
        dependencies: "Tracking access",
        clientResponsibilities: "Confirm source access",
        exclusions: "new websites, photography, outsourced reception, custom development, extra locations or service lines",
        thirdPartyCosts: "Platform media and third-party tools are separate",
        inclusionStatus: "included",
        deliveryType: "recurring",
        isOptionalAddOn: false,
        approvalStatus: "not_required",
        sortOrder: 10,
      },
      {
        category: "Paid Search",
        title: "Google Ads management",
        clientDescription: "Stored Google Ads scope wording supplied by proposal data.",
        frequency: "Ongoing; weekly optimisation",
        quantityLimit: "Agreed campaign set",
        treatmentsAndLocations: "Priority dental treatments selected in discovery",
        dependencies: "Clinic funds media directly and approves claims.",
        clientResponsibilities: "Approve claims",
        exclusions: "additional campaign sets",
        thirdPartyCosts: "Google Ads media spend is paid separately",
        inclusionStatus: "included",
        deliveryType: "recurring",
        isOptionalAddOn: false,
        approvalStatus: "not_required",
        sortOrder: 20,
      },
      {
        category: "Local Visibility",
        title: "SEO and Google Business Profile management",
        clientDescription: "Stored SEO and GBP scope wording supplied by proposal data.",
        frequency: "Monthly",
        quantityLimit: "One location",
        treatmentsAndLocations: "One practice location",
        dependencies: "Requires website and profile access.",
        clientResponsibilities: "Provide access",
        exclusions: "extra locations or service lines",
        thirdPartyCosts: "External listing or content costs are separate if needed",
        inclusionStatus: "included",
        deliveryType: "recurring",
        isOptionalAddOn: false,
        approvalStatus: "not_required",
        sortOrder: 30,
      },
      {
        category: "Conversion",
        title: "Conversion and landing page optimisation",
        clientDescription: "Stored conversion scope wording supplied by proposal data.",
        frequency: "Ongoing",
        quantityLimit: "Existing priority pages only",
        treatmentsAndLocations: "Existing priority treatment pages",
        dependencies: "Clinic approves offers, claims and treatment-page changes.",
        clientResponsibilities: "Approve changes",
        exclusions: "new websites and photography",
        thirdPartyCosts: "New creative production is separate",
        inclusionStatus: "included",
        deliveryType: "recurring",
        isOptionalAddOn: false,
        approvalStatus: "not_required",
        sortOrder: 40,
      },
      {
        category: "Operating System",
        title: "Full OS and reporting",
        clientDescription: "Stored OS and reporting scope wording supplied by proposal data.",
        frequency: "Continuous; weekly and monthly review",
        quantityLimit: "Supported connections",
        treatmentsAndLocations: "Supported clinic journeys where data is connected",
        dependencies: "Clinic confirms status and data accuracy.",
        clientResponsibilities: "Confirm data accuracy",
        exclusions: "custom development",
        thirdPartyCosts: "Integration/provider costs remain separate",
        inclusionStatus: "included",
        deliveryType: "recurring",
        isOptionalAddOn: false,
        approvalStatus: "not_required",
        sortOrder: 50,
      },
    ],
    proofAssets: [
      {
        id: "proof-result-1",
        type: "performance_result",
        title: "+262.73%",
        copy: "Increase in high-intent enquiries after managed marketing work was reviewed against source reporting.",
        mediaUrl: null,
        sectorTags: [
          "dental",
          "state:known",
          "proof_scope:Cross-sector company delivery proof - not same-sector or OS results",
          "source:ClinicGrower approved proof library",
          "timeframe:Documented delivery period",
          "disclaimer:Proof is historical managed-marketing evidence, not a ClinicGrower OS guarantee.",
        ],
        sortOrder: 10,
        isActive: true,
        createdAt: "2026-08-10T09:00:00.000Z",
        updatedAt: "2026-08-10T09:00:00.000Z",
      },
      {
        id: "proof-result-2",
        type: "performance_result",
        title: "-31.41%",
        copy: "Reduction in cost per enquiry after campaign and conversion work was tightened.",
        mediaUrl: null,
        sectorTags: [
          "dental",
          "state:known",
          "proof_scope:Cross-sector company delivery proof - not same-sector or OS results",
          "source:ClinicGrower approved proof library",
          "timeframe:Documented delivery period",
          "disclaimer:Proof is historical managed-marketing evidence, not a ClinicGrower OS guarantee.",
        ],
        sortOrder: 20,
        isActive: true,
        createdAt: "2026-08-10T09:00:00.000Z",
        updatedAt: "2026-08-10T09:00:00.000Z",
      },
      {
        id: "proof-result-3",
        type: "performance_result",
        title: "+100.6%",
        copy: "Increase in qualified consultation demand where campaign context and delivery inputs were recorded.",
        mediaUrl: null,
        sectorTags: [
          "dental",
          "state:known",
          "proof_scope:Cross-sector company delivery proof - not same-sector or OS results",
          "source:ClinicGrower approved proof library",
          "timeframe:Documented delivery period",
          "disclaimer:Proof is historical managed-marketing evidence, not a ClinicGrower OS guarantee.",
        ],
        sortOrder: 30,
        isActive: true,
        createdAt: "2026-08-10T09:00:00.000Z",
        updatedAt: "2026-08-10T09:00:00.000Z",
      },
      {
        id: "proof-testimonial-1",
        type: "testimonial",
        title: "Dr Tanja Phillips, approved ClinicGrower proof asset",
        copy: "ClinicGrower gave us clearer visibility over where demand was coming from and what needed attention first.",
        mediaUrl: "/brand/proposal/v5-reference/dental_practices/p17-img02-2400x1350.png",
        sectorTags: [
          "dental",
          "state:known",
          "source:ClinicGrower approved testimonial library",
          "timeframe:Permissioned testimonial",
          "disclaimer:Named testimonial is used only where permission exists.",
        ],
        sortOrder: 40,
        isActive: true,
        createdAt: "2026-08-10T09:00:00.000Z",
        updatedAt: "2026-08-10T09:00:00.000Z",
      },
      {
        id: "proof-video-1",
        type: "testimonial_video",
        title: "Founder video proof route",
        copy: "Founder video and supporting proof are available through the approved proposal proof route.",
        mediaUrl: "https://vimeo.com/1008757315",
        sectorTags: [
          "dental",
          "state:known",
          "source:ClinicGrower approved video library",
          "timeframe:Current proposal proof set",
          "disclaimer:Video proof supports the proposal narrative and does not imply guaranteed results.",
        ],
        sortOrder: 50,
        isActive: true,
        createdAt: "2026-08-10T09:00:00.000Z",
        updatedAt: "2026-08-10T09:00:00.000Z",
      },
      {
        id: "proof-case-study-1",
        type: "case_study",
        title: "Dental case study with delivery context",
        copy: "Approved dental case study showing enquiry visibility and booking-accountability work for a private dental clinic.",
        mediaUrl: "https://clinicgrower.co.uk/case-studies/dental",
        sectorTags: [
          "dental",
          "state:known",
          "source:ClinicGrower approved case-study library",
          "timeframe:Documented delivery period",
          "disclaimer:Case-study evidence is contextual and not a guarantee.",
        ],
        sortOrder: 60,
        isActive: true,
        createdAt: "2026-08-10T09:00:00.000Z",
        updatedAt: "2026-08-10T09:00:00.000Z",
      },
      {
        id: "proof-product-screenshot-1",
        type: "product_screenshot",
        title: "ClinicGrower OS dental performance view",
        copy: "Real ClinicGrower OS screenshot showing dental enquiry, booking and next-action visibility where connected.",
        mediaUrl: "/brand/proposal/v5-reference/dental_practices/p07-img01-1440x662.png",
        sectorTags: [
          "dental",
          "clinicgrower os",
          "product screenshot",
          "state:known",
          "source:ClinicGrower OS product screenshot library",
          "timeframe:Current V5 product reference",
          "disclaimer:Product screenshot is illustrative of ClinicGrower OS visibility where supported sources are connected.",
        ],
        sortOrder: 70,
        isActive: true,
        createdAt: "2026-08-10T09:00:00.000Z",
        updatedAt: "2026-08-10T09:00:00.000Z",
      },
    ],
  },
  coreData: null,
  contactName: "Alex Owner",
  accountName: "Example Dental",
  clientAccountName: null,
};

const basePackage: Partial<GrowthPackageRecord> = {
  id: "package-performance-os",
  name: "Performance OS",
  priceCents: 99_500,
  setupFeeCents: 0,
  currency: "GBP",
  billingFrequency: "monthly",
  catalogueVersion: "v5",
};

function canonicalPackage({
  id,
  name,
  priceCents,
  setupFeeCents,
  billingFrequency = "monthly",
  scopeTitle,
  exclusion,
  responsibility,
}: {
  id: string;
  name: string;
  priceCents: number;
  setupFeeCents: number;
  billingFrequency?: GrowthPackageRecord["billingFrequency"];
  scopeTitle: string;
  exclusion: string;
  responsibility: string;
}): Partial<GrowthPackageRecord> & { id: string; name: string; priceCents: number } {
  return {
    id,
    name,
    priceCents,
    setupFeeCents,
    currency: "GBP",
    billingFrequency,
    catalogueVersion: "clinicgrower_v5_2026_08",
    commercialNotes: {
      v5ScopeItems: [
        {
          category: "ClinicGrower OS",
          title: scopeTitle,
          description: `${name} catalogue scope.`,
          frequency: billingFrequency === "one_off" ? "One-off" : "Monthly",
          quantityLimit: "Selected priority journey",
          treatmentsAndLocations: "Proposal-selected services and locations",
          dependency: "Confirmed access and source data",
          owner: responsibility,
          exclusion,
          thirdPartyCosts: "Paid media and third-party tools remain separate",
          inclusionStatus: "included",
          deliveryType: billingFrequency === "one_off" ? "one_off" : "recurring",
          isOptionalAddOn: false,
          approvalStatus: "not_required",
          sortOrder: 10,
        },
      ],
    },
  };
}

const approvedClinicTypeCases = [
  ["Aesthetic Clinics", "aesthetic_clinics", "aesthetic_clinic"],
  ["Dental Practices", "dental_practice", "dental_clinic"],
  ["Cosmetic Surgery Clinics", "cosmetic_surgery", "cosmetic_surgery_clinic"],
  ["Dermatology Clinics", "dermatology", "dermatology_clinic"],
  ["Hair Transplant Clinics", "hair_transplant", "hair_transplant_clinic"],
  ["Wellness Clinics", "wellness", "wellness_clinic"],
  ["Private GP & Medical Clinics", "private_gp_medical", "private_gp_medical_clinic"],
  ["Medical Spas", "medical_spa", "medical_spa"],
] as const;

const v5PackageCases = [
  canonicalPackage({
    id: "package-free-clinic-growth-audit",
    name: "Free Clinic Growth Audit",
    priceCents: 0,
    setupFeeCents: 0,
    billingFrequency: "one_off",
    scopeTitle: "Outside-in growth audit",
    responsibility: "Provide public clinic context and decision-maker input.",
    exclusion: "Connected ClinicGrower OS data and paid media management",
  }),
  canonicalPackage({
    id: "package-growth-diagnostic",
    name: "Growth Diagnostic",
    priceCents: 39_500,
    setupFeeCents: 0,
    scopeTitle: "Monthly diagnostic and priority recommendations",
    responsibility: "Confirm source access and attend the review cadence.",
    exclusion: "Managed media, delivery execution and custom reporting builds",
  }),
  canonicalPackage({
    id: "package-lead-concierge",
    name: "Lead Concierge",
    priceCents: 59_500,
    setupFeeCents: 0,
    scopeTitle: "Lead response ownership and follow-up visibility",
    responsibility: "Confirm enquiry handling owners and response standards.",
    exclusion: "New website builds, paid media management and outsourced reception",
  }),
  canonicalPackage({
    id: "package-starter-engine",
    name: "Starter Engine",
    priceCents: 99_500,
    setupFeeCents: 0,
    scopeTitle: "Starter growth operating rhythm",
    responsibility: "Approve the first priority journey and provide tracking access.",
    exclusion: "Multi-location delivery, custom integrations and expanded campaign sets",
  }),
  canonicalPackage({
    id: "package-growth-partner",
    name: "Growth Partner",
    priceCents: 169_500,
    setupFeeCents: 0,
    scopeTitle: "Growth accountability layer",
    responsibility: "Approve journey priorities, claims and clinic-side actions.",
    exclusion: "Additional locations, bespoke development and unsupported data sources",
  }),
  canonicalPackage({
    id: "package-clinic-growth-engine",
    name: "Clinic Growth Engine",
    priceCents: 249_500,
    setupFeeCents: 99_500,
    scopeTitle: "ClinicGrower OS commercial layer",
    responsibility: "Provide source access, approve media claims and confirm capacity.",
    exclusion: "Photography, outsourced reception, new websites and unapproved service lines",
  }),
  canonicalPackage({
    id: "package-growth-engine-plus",
    name: "Growth Engine Plus",
    priceCents: 349_500,
    setupFeeCents: 99_500,
    scopeTitle: "Expanded multi-journey ClinicGrower OS layer",
    responsibility: "Confirm owners for each approved journey and provide access.",
    exclusion: "Unscoped locations, unsupported integrations and separate creative production",
  }),
  canonicalPackage({
    id: "package-market-leader",
    name: "Market Leader",
    priceCents: 499_500,
    setupFeeCents: 99_500,
    scopeTitle: "Senior market leadership operating system",
    responsibility: "Approve senior strategy decisions, access and market priorities.",
    exclusion: "Unapproved markets, third-party tools and media spend",
  }),
];

function buildSnapshot(proposal: ProposalPublicRecord = baseProposal, packageRecord = basePackage) {
  return buildProposalV5Snapshot({
    proposal,
    packageRecord,
    generatedAt: "2026-08-10T10:00:00.000Z",
    sourceProposalVersion: "source-version-1",
    acceptanceUrl: "https://crm.clinicgrower.co.uk/proposals/accept/test",
    questionUrl: "https://crm.clinicgrower.co.uk/proposals/questions/test",
  });
}

function extractProofPair(html: string, title: string) {
  const titleIndex = html.indexOf(title);
  expect(titleIndex, `${title} should render`).toBeGreaterThanOrEqual(0);
  const articleStart = html.lastIndexOf("<article", titleIndex);
  const articleEnd = html.indexOf("</article>", titleIndex);
  expect(articleStart, `${title} should render inside a proof pair`).toBeGreaterThanOrEqual(0);
  expect(articleEnd, `${title} proof pair should close`).toBeGreaterThanOrEqual(titleIndex);
  return html.slice(articleStart, articleEnd);
}

function proofAssetsForCount(count: number) {
  const templates = [
    {
      type: "award",
      title: "Aesthetics Awards proof",
      copy: "Award recognition selected for the proposal proof sequence.",
      mediaUrl: "/brand/proof/award-density.webp",
      sectorTags: ["dental", "state:known", "source:ClinicGrower awards library", "timeframe:2025", "disclaimer:Credibility proof only."],
    },
    {
      type: "case_study",
      title: "Dental case study proof",
      copy: "Dental case study with documented delivery context and relevance to the selected clinic type.",
      mediaUrl: "/brand/proof/case-density.webp",
      sectorTags: ["dental", "case study", "state:known", "source:ClinicGrower proof library", "timeframe:90 days", "disclaimer:Contextual proof only."],
    },
    {
      type: "testimonial",
      title: "Permissioned testimonial proof",
      copy: "Permission approved clinic owner testimonial selected for this proposal.",
      mediaUrl: null,
      sectorTags: ["dental", "permission approved", "state:known", "source:ClinicGrower testimonial library", "timeframe:Permissioned testimonial", "disclaimer:Permissioned proof only."],
    },
    {
      type: "performance_result",
      title: "Booked-consultation result",
      copy: "Over 90 days, enquiry and booking accountability became clearer against the selected delivery context.",
      mediaUrl: "/brand/proof/result-density.webp",
      sectorTags: ["dental", "state:known", "proof_scope:Dental delivery proof.", "source:ClinicGrower proof library", "timeframe:90 days", "disclaimer:Historical proof only."],
    },
    {
      type: "product_screenshot",
      title: "ClinicGrower OS screenshot",
      copy: "ClinicGrower OS screenshot showing leakage visibility and next actions where connected.",
      mediaUrl: "/brand/proof/os-density.webp",
      sectorTags: ["dental", "clinicgrower os", "product screenshot", "state:known", "source:ClinicGrower OS screenshot library", "timeframe:Current V5 reference", "disclaimer:Illustrative where connected."],
    },
  ] as const;

  return Array.from({ length: count }, (_, index) => {
    const template = templates[index % templates.length];
    return {
      ...template,
      id: `density-proof-${index + 1}`,
      title: `${template.title} ${index + 1}`,
      mediaUrl: index % 4 === 2 ? null : template.mediaUrl,
      sectorTags: [...template.sectorTags],
      sortOrder: index + 1,
      isActive: true,
      createdAt: "2026-08-10T09:00:00.000Z",
      updatedAt: "2026-08-10T09:00:00.000Z",
    };
  });
}

function expectPublicBrandAssetExists(url: string | null | undefined) {
  expect(url).toBeTruthy();
  expect(url).toMatch(/^\/brand\//);
  const publicPath = join(process.cwd(), "public", (url as string).replace(/^\//, ""));
  expect(existsSync(publicPath), `${url} should resolve to ${publicPath}`).toBe(true);
}

describe("Proposal V5 renderer foundation", () => {
  it("registers exactly 19 pages in the approved order", () => {
    validateProposalV5PageRegistry();

    expect(proposalV5PageRegistry).toHaveLength(19);
    expect(proposalV5PageRegistry.map((page) => page.id)).toEqual(proposalV5PageOrder.map((page) => page.id));
  });

  it("uses explicit page IDs, page numbers and dark-page rhythm", () => {
    expect(proposalV5PageRegistry.map((page) => page.pageNumber)).toEqual(Array.from({ length: 19 }, (_, index) => index + 1));
    expect(proposalV5PageRegistry.filter((page) => page.theme === "dark").map((page) => page.pageNumber)).toEqual([
      ...proposalV5Tokens.darkPages,
    ]);
  });

  it("renders exactly 19 bounded A4 page sections", () => {
    const snapshot = buildSnapshot();
    const html = renderToStaticMarkup(createElement(ProposalV5Renderer, { snapshot }));

    expect(html.match(/data-v5-page-id=/g)).toHaveLength(19);
    expect(html).toContain('class="proposal-v5-renderer"');
    expect(html).toContain("width:210mm");
    expect(html).toContain("height:297mm");
    expect(html).toContain("overflow:hidden");
    expect(html).toContain('data-v5-page-number="19"');
  });

  it("keeps clinic type and selected package independent", () => {
    const dentalSnapshot = buildSnapshot();
    const aestheticsSnapshot = buildSnapshot({
      ...baseProposal,
      sectionContent: {
        ...baseProposal.sectionContent,
        clinicTypeVariant: "aesthetic_clinic",
      },
    });
    const growthEngineSnapshot = buildSnapshot(baseProposal, {
      ...basePackage,
      id: "package-growth-engine",
      name: "Growth Engine",
      priceCents: 199_500,
    });

    expect(dentalSnapshot.clinic.clinicType).toBe("dental_clinic");
    expect(aestheticsSnapshot.clinic.clinicType).toBe("aesthetic_clinic");
    expect(aestheticsSnapshot.selectedPackage.id).toBe(dentalSnapshot.selectedPackage.id);
    expect(growthEngineSnapshot.clinic.clinicType).toBe(dentalSnapshot.clinic.clinicType);
    expect(growthEngineSnapshot.selectedPackage.id).toBe("package-growth-engine");
  });

  it.each(v5PackageCases)("uses selected package catalogue scope for %s", (packageRecord) => {
    const snapshot = buildSnapshot({
      ...baseProposal,
      valueCents: null,
      monthlyFeeCents: null,
      setupFeeCents: null,
      sectionContent: {
        ...baseProposal.sectionContent,
        scopeItems: [
          {
            category: "Legacy proposal scope",
            title: "This stale proposal scope must not render",
            clientDescription: "Old scope from a previous selected package.",
            frequency: "Old cadence",
            quantityLimit: "Old limit",
            treatmentsAndLocations: "Old services",
            dependencies: "Old dependency",
            clientResponsibilities: "Old responsibility",
            exclusions: "Old exclusion",
            thirdPartyCosts: "Old third-party cost",
            inclusionStatus: "included",
            deliveryType: "recurring",
            isOptionalAddOn: false,
            approvalStatus: "not_required",
            sortOrder: 10,
          },
        ],
      },
    }, packageRecord);
    const packageScope = getPackageProposalV5Scope(packageRecord);
    const html = renderToStaticMarkup(createElement(V5Page15ScopeMatrix, { snapshot }));

    expect(snapshot.selectedPackage.id).toBe(packageRecord.id);
    expect(snapshot.selectedPackage.name).toBe(packageRecord.name);
    expect(snapshot.selectedPackage.monthlyFeeCents).toBe(packageRecord.billingFrequency === "monthly" ? packageRecord.priceCents : null);
    expect(snapshot.selectedPackage.setupFeeCents).toBe(packageRecord.setupFeeCents);
    expect(packageScope.length).toBeGreaterThan(0);
    expect(snapshot.scope).toEqual(packageScope);
    expect(html).toContain(packageScope[0].title as string);
    expect(html).toContain(packageScope[0].owner as string);
    expect(html).toContain(packageScope[0].exclusion as string);
    expect(html).not.toContain("This stale proposal scope must not render");
  });

  it.each(v5PackageCases)("keeps selected package scope independent from clinic type for %s", (packageRecord) => {
    const dentalSnapshot = buildSnapshot(baseProposal, packageRecord);
    const aestheticsSnapshot = buildSnapshot({
      ...baseProposal,
      sectionContent: {
        ...baseProposal.sectionContent,
        clinicTypeVariant: "aesthetic_clinic",
      },
    }, packageRecord);

    expect(dentalSnapshot.clinic.clinicType).toBe("dental_clinic");
    expect(aestheticsSnapshot.clinic.clinicType).toBe("aesthetic_clinic");
    expect(dentalSnapshot.selectedPackage.id).toBe(aestheticsSnapshot.selectedPackage.id);
    expect(dentalSnapshot.scope).toEqual(aestheticsSnapshot.scope);
  });

  it("resolves missing or invalid clinic type to the neutral general variant", () => {
    const missingSnapshot = buildSnapshot({
      ...baseProposal,
      sectionContent: {
        ...baseProposal.sectionContent,
        clinicTypeVariant: null,
      },
    });
    const invalidSnapshot = buildSnapshot({
      ...baseProposal,
      sectionContent: {
        ...baseProposal.sectionContent,
        clinicTypeVariant: "unknown_clinic_type",
      },
    });

    expect(proposalV5ClinicTypeIds).toContain("general");
    expect(missingSnapshot.clinic.clinicType).toBe("general");
    expect(invalidSnapshot.clinic.clinicType).toBe("general");
    expect(missingSnapshot.clinic.typeLabel).toBe("General ClinicGrower");
    expect(missingSnapshot.assets.sectorImages.cover.url).toContain("/brand/proposal/website-source/");
    expect(missingSnapshot.clinic.proofTags).toEqual(["clinic", "general", "clinicgrower os"]);
    expect(missingSnapshot.clinic.typeLabel).not.toContain("Aesthetic");
  });

  it.each(approvedClinicTypeCases)("maps the approved website clinic type %s into the V5 variant layer", (_label, input, expected) => {
    const snapshot = buildSnapshot({
      ...baseProposal,
      sectionContent: {
        ...baseProposal.sectionContent,
        clinicTypeVariant: input,
      },
    });

    expect(snapshot.clinic.clinicType).toBe(expected);
    expect(snapshot.selectedPackage.id).toBe(basePackage.id);
    expect(snapshot.assets.sectorImages.cover.url).toBeTruthy();
    expect(snapshot.clinic.proofTags.length).toBeGreaterThan(0);
  });

  it.each(approvedClinicTypeCases)("resolves V5 public brand assets for %s", (_label, input) => {
    const snapshot = buildSnapshot({
      ...baseProposal,
      sectionContent: {
        ...baseProposal.sectionContent,
        clinicTypeVariant: input,
      },
    });

    expectPublicBrandAssetExists(snapshot.assets.sectorImages.cover.url);
    expectPublicBrandAssetExists(snapshot.assets.sectorImages.journey.url);
    expectPublicBrandAssetExists(snapshot.assets.sectorImages.proof.url);
    expectPublicBrandAssetExists(snapshot.assets.sectorImages.close.url);
    snapshot.assets.osScreens.forEach((image) => expectPublicBrandAssetExists(image.url));
    expectPublicBrandAssetExists(snapshot.assets.founderVideoThumbnail?.url);
    expectPublicBrandAssetExists(snapshot.assets.postBookingScreenshot?.url);
    expectPublicBrandAssetExists(snapshot.assets.implementationImage?.url);
  });

  it.each(approvedClinicTypeCases)("renders all 19 V5 pages for the approved clinic type %s", (_label, input, expected) => {
    const variantSnapshot = buildSnapshot({
      ...baseProposal,
      sectionContent: {
        ...baseProposal.sectionContent,
        clinicTypeVariant: input,
        activeConstraintId: null,
      },
    });
    const snapshot = buildSnapshot({
      ...baseProposal,
      sectionContent: {
        ...baseProposal.sectionContent,
        clinicTypeVariant: input,
        activeConstraintId: variantSnapshot.journey.stages[3] || variantSnapshot.journey.stages[0],
      },
    });
    const html = renderToStaticMarkup(createElement(ProposalV5Renderer, { snapshot }));

    expect(snapshot.clinic.clinicType).toBe(expected);
    expect(html.match(/data-v5-page-id=/g)).toHaveLength(19);
    expect(html).toContain('data-v5-page-number="19"');
    expect(html).not.toContain('data-v5-page-number="20"');
    expect(html).not.toMatch(/localhost|data-proposal-v5|source-version-1/i);
  });

  it.each(v5PackageCases)("renders the V5 package %s independently from clinic type", (packageRecord) => {
    const dentalSnapshot = buildSnapshot(baseProposal, packageRecord);
    const aestheticsSnapshot = buildSnapshot({
      ...baseProposal,
      sectionContent: {
        ...baseProposal.sectionContent,
        clinicTypeVariant: "aesthetic_clinic",
      },
    }, packageRecord);
    const html = renderToStaticMarkup(createElement(V5Page18Investment, { snapshot: dentalSnapshot }));

    expect(dentalSnapshot.selectedPackage.id).toBe(packageRecord.id);
    expect(dentalSnapshot.selectedPackage.name).toBe(packageRecord.name);
    expect(aestheticsSnapshot.selectedPackage.id).toBe(packageRecord.id);
    expect(aestheticsSnapshot.clinic.clinicType).toBe("aesthetic_clinic");
    expect(dentalSnapshot.clinic.clinicType).toBe("dental_clinic");
    expect(html).toContain(packageRecord.name);
    expect(html).not.toContain(packageRecord.id);
  });

  it("does not render mojibake, internal version data or development placeholder language in the full V5 output", () => {
    const snapshot = buildSnapshot();
    const html = renderToStaticMarkup(createElement(ProposalV5Renderer, { snapshot }));

    expect(html).not.toMatch(/[ÃÂ]/);
    expect(html).not.toMatch(/Lorem ipsum|required before sending|source version|snapshot hash|package ID|localhost/i);
    expect(html).not.toContain(snapshot.sourceProposalVersion);
    expect(html).not.toContain(snapshot.snapshotHash);
  });

  it("builds deterministic snapshots with deterministic metadata and hash", () => {
    const firstSnapshot = buildSnapshot();
    const secondSnapshot = buildSnapshot();

    expect(firstSnapshot).toEqual(secondSnapshot);
    expect(firstSnapshot.schemaVersion).toBe("proposal_v5");
    expect(firstSnapshot.proposal.reference).toBe("CG-V5-TEST-001");
    expect(firstSnapshot.generatedAt).toBe("2026-08-10T10:00:00.000Z");
    expect(firstSnapshot.sourceProposalVersion).toBe("source-version-1");
    expect(firstSnapshot.snapshotHash).toMatch(/^[a-f0-9]{64}$/);

    const reorderedSnapshot = buildSnapshot({
      ...baseProposal,
      sectionContent: Object.fromEntries(Object.entries(baseProposal.sectionContent || {}).reverse()) as never,
    });
    expect(reorderedSnapshot.snapshotHash).toBe(firstSnapshot.snapshotHash);

    const changedSnapshot = buildSnapshot({
      ...baseProposal,
      sectionContent: {
        ...baseProposal.sectionContent,
        primaryGoal: "Changed known source goal.",
      },
    });
    expect(changedSnapshot.snapshotHash).not.toBe(firstSnapshot.snapshotHash);
  });

  it("preserves the customer-safe proposal reference through serialization and hashing", () => {
    const snapshot = buildSnapshot();
    const serialized = JSON.stringify(snapshot);
    const parsed = JSON.parse(serialized);

    expect(parsed.proposal.reference).toBe("CG-V5-TEST-001");
    expect(parsed.snapshotHash).toBe(snapshot.snapshotHash);

    const changedReferenceSnapshot = buildSnapshot({
      ...baseProposal,
      sectionContent: {
        ...baseProposal.sectionContent,
        proposalReference: "CG-V5-TEST-002",
      },
    });

    expect(changedReferenceSnapshot.proposal.reference).toBe("CG-V5-TEST-002");
    expect(changedReferenceSnapshot.snapshotHash).not.toBe(snapshot.snapshotHash);
  });

  it("distinguishes public-safe V5 snapshots from internal frozen snapshots", () => {
    const snapshot = buildSnapshot();
    const publicSnapshot = JSON.parse(JSON.stringify(snapshot));
    delete publicSnapshot.snapshotHash;
    delete publicSnapshot.sourceProposalVersion;
    delete publicSnapshot.selectedPackage.id;
    delete publicSnapshot.selectedPackage.catalogueVersion;
    publicSnapshot.proof.forEach((asset: Record<string, unknown>) => {
      delete asset.id;
    });
    Object.values(publicSnapshot.assets.sectorImages).forEach((image) => {
      delete (image as Record<string, unknown>).imageId;
    });
    publicSnapshot.assets.osScreens.forEach((image: Record<string, unknown>) => {
      delete image.imageId;
    });
    delete publicSnapshot.assets.founderVideoThumbnail.imageId;
    delete publicSnapshot.assets.postBookingScreenshot.imageId;
    delete publicSnapshot.assets.implementationImage.imageId;
    delete publicSnapshot.acceptance.lockedSnapshotHash;

    expect(isProposalV5PublicSnapshot(snapshot)).toBe(false);
    expect(isProposalV5PublicSnapshot(publicSnapshot)).toBe(true);

    const html = renderToStaticMarkup(createElement(ProposalV5Renderer, { snapshot: publicSnapshot }));
    expect(html).toContain("CG-V5-TEST-001");
    expect(html).not.toContain(snapshot.snapshotHash);
    expect(html).not.toContain(snapshot.sourceProposalVersion);
    expect(html).not.toContain("package-performance-os");
    expect(html).not.toContain("proof-result-1");
    expect(html).not.toContain("dental-cover");
  });

  it("rejects raw proposal records at the renderer boundary", () => {
    expect(() =>
      renderToStaticMarkup(createElement(ProposalV5Renderer, { snapshot: baseProposal as never })),
    ).toThrow(/ProposalV5Renderer requires ProposalV5Snapshot/);
  });

  it("renders Page 01 from ProposalV5Snapshot with the required cover data", () => {
    const snapshot = buildSnapshot();
    const html = renderToStaticMarkup(createElement(V5Page01Cover, { snapshot }));

    expect(getV5Page01MissingFields(snapshot)).toEqual([]);
    expect(html.match(/data-v5-page-id=/g)).toHaveLength(1);
    expect(html).toContain('data-v5-page-id="V5Page01Cover"');
    expect(html).toContain("Example Dental");
    expect(html).toContain("CG-V5-TEST-001");
    expect(html).toContain("Bristol private dental practice");
    expect(html).toContain("Known source goal.");
    expect(html).toContain("/brand/proposal/v5-reference/dental_practices/p01-img02-1672x941.png");
  });

  it("keeps Page 01 at one A4 page with the approved dark treatment and full-width hero", () => {
    const html = renderToStaticMarkup(createElement(V5Page01Cover, { snapshot: buildSnapshot() }));

    expect(html).toContain("width:210mm");
    expect(html).toContain("height:297mm");
    expect(html).toContain("padding:17mm 17mm 19mm");
    expect(html).toContain("background:#011418");
    expect(html).toContain("width:176mm");
    expect(html).toContain("height:106mm");
    expect(html).toContain("margin-left:calc(-1 * 17mm)");
    expect(html).toContain('data-v5-page-number="1"');
  });

  it.each([
    ["normal", "BristolDent Harbourside", "34pt"],
    ["long", "The Very Long Name Private Dental, Implant, Aesthetic and Specialist Referral Centre at Harbourside and Clifton", "23pt"],
    [
      "extreme",
      "The Very Long Name Private Dental, Implant, Aesthetic, Specialist Referral, Facial Aesthetics, Orthodontic, Implant, Sedation and Complex Care Centre Serving Harbourside, Clifton, Bristol, Bath and the Wider South West Region",
      "13pt",
    ],
  ])("keeps Page 01 metadata visible for a %s clinic name", (_caseName, clinicName, expectedFontSize) => {
    const snapshot = buildSnapshot({
      ...baseProposal,
      accountName: clinicName,
      clientAccountName: clinicName,
    });
    const html = renderToStaticMarkup(createElement(V5Page01Cover, { snapshot }));

    expect(html).toContain(clinicName);
    expect(html).toContain(`font-size:${expectedFontSize}`);
    expect(html).toContain("Prepared for");
    expect(html).toContain("Reference");
    expect(html).toContain("Location");
    expect(html).toContain("Programme");
    expect(html).toContain("Valid until");
    expect(html).toContain("Alex Owner");
    expect(html).toContain("Bristol private dental practice");
    expect(html).toContain("Performance OS");
    expect(html).toContain("30 September 2026");
    expect(html.match(/data-v5-page-id=/g)).toHaveLength(1);
    expect(html).not.toContain('data-v5-page-number="2"');
  });

  it("keeps Page 01 deterministic", () => {
    const snapshot = buildSnapshot();
    const firstHtml = renderToStaticMarkup(createElement(V5Page01Cover, { snapshot }));
    const secondHtml = renderToStaticMarkup(createElement(V5Page01Cover, { snapshot }));

    expect(firstHtml).toBe(secondHtml);
  });

  it("rejects raw proposal records at the Page 01 boundary", () => {
    expect(() =>
      renderToStaticMarkup(createElement(V5Page01Cover, { snapshot: baseProposal as never })),
    ).toThrow(/V5Page01Cover is missing required snapshot data/);
  });

  it("does not render fallback or structural placeholder copy on Page 01", () => {
    const html = renderToStaticMarkup(createElement(V5Page01Cover, { snapshot: buildSnapshot() }));

    expect(html).not.toMatch(/fallback/i);
    expect(html).not.toMatch(/placeholder/i);
    expect(html).not.toMatch(/to be agreed/i);
    expect(html).not.toMatch(/Page 01 cover structure/i);
    expect(html).not.toMatch(/localhost/i);
  });

  it("renders Pages 01-05 together with the approved order and phase page count", () => {
    const snapshot = buildSnapshot();
    const pageComponents = [
      V5Page01Cover,
      V5Page02EvidenceQuestions,
      V5Page03EvidenceTrail,
      V5Page04CommercialDiagnosis,
      V5Page05PartnerProposition,
    ];
    const html = pageComponents.map((Component) => renderToStaticMarkup(createElement(Component, { snapshot }))).join("");

    expect(html.match(/data-v5-page-id=/g)).toHaveLength(5);
    expect(html).toContain('data-v5-page-id="V5Page01Cover"');
    expect(html).toContain('data-v5-page-id="V5Page02EvidenceQuestions"');
    expect(html).toContain('data-v5-page-id="V5Page03EvidenceTrail"');
    expect(html).toContain('data-v5-page-id="V5Page04CommercialDiagnosis"');
    expect(html).toContain('data-v5-page-id="V5Page05PartnerProposition"');
    expect(html).not.toContain('data-v5-page-id="V5Page06SystemsFit"');
    expect(html.match(/width:210mm;height:297mm/g)).toHaveLength(5);
    expect(html.match(/overflow:hidden/g)?.length || 0).toBeGreaterThanOrEqual(5);
  });

  it("renders Page 02 owner evidence questions from required snapshot data", () => {
    const snapshot = buildSnapshot();
    const html = renderToStaticMarkup(createElement(V5Page02EvidenceQuestions, { snapshot }));

    expect(getV5Page02MissingFields(snapshot)).toEqual([]);
    expect(html).toContain("The owner test");
    expect(html).toContain("Could you answer these four questions, with evidence, by 10am today?");
    expect(html).toContain("If not, you are deciding blind.");
    expect(html).toContain("accepted implant cases");
    expect(html).toContain("implants opportunity value");
  });

  it("renders Page 03 evidence trail with the V5 dark-page treatment", () => {
    const snapshot = buildSnapshot();
    const html = renderToStaticMarkup(createElement(V5Page03EvidenceTrail, { snapshot }));

    expect(getV5Page03MissingFields(snapshot)).toEqual([]);
    expect(html).toContain('data-v5-page-id="V5Page03EvidenceTrail"');
    expect(html).toContain('data-v5-page-theme="dark"');
    expect(html).toContain("Evidence before opinion");
    expect(html).toContain("When the numbers conflict, the clinic owner carries the risk.");
    expect(html).toContain("One source of truth. One named owner. One next commercial action.");
  });

  it("renders Page 04 from the clinic-specific money path and diagnosed leaks", () => {
    const snapshot = buildSnapshot();
    const html = renderToStaticMarkup(createElement(V5Page04CommercialDiagnosis, { snapshot }));

    expect(getV5Page04MissingFields(snapshot)).toEqual([]);
    expect(html).toContain("Where is Example Dental&#x27;s money getting stuck?");
    expect(html).toContain("Treatment-coordinator review");
    expect(html).toContain("Working constraint");
    expect(html).toContain("Lead handling");
    expect(html).toContain("Booked assessments do not reliably become attended consultations.");
  });

  it("stops Page 04 when the active constraint is not mapped to the snapshot journey", () => {
    const snapshot = buildSnapshot({
      ...baseProposal,
      sectionContent: {
        ...baseProposal.sectionContent,
        activeConstraintId: "unmapped constraint",
      },
    });

    expect(getV5Page04MissingFields(snapshot)).toContain("journey.activeConstraint.value matching journey.stages");
    expect(() => renderToStaticMarkup(createElement(V5Page04CommercialDiagnosis, { snapshot }))).toThrow(
      /journey.activeConstraint.value matching journey.stages/,
    );
  });

  it("renders Page 05 only when the founder video URL and thumbnail are present in the snapshot", () => {
    const snapshot = buildSnapshot();
    const html = renderToStaticMarkup(createElement(V5Page05PartnerProposition, { snapshot }));

    expect(getV5Page05MissingFields(snapshot)).toEqual([]);
    expect(html).toContain("Why ClinicGrower owns both");
    expect(html).toContain("One partner should own demand and patient progression.");
    expect(html).toContain("https://vimeo.com/1008757315");
    expect(html).toContain("/brand/proposal/v5-reference/dental_practices/p05-img02-2400x1350.png");
  });

  it("rejects raw proposal records at the Page 02-05 boundaries", () => {
    expect(() => renderToStaticMarkup(createElement(V5Page02EvidenceQuestions, { snapshot: baseProposal as never }))).toThrow(
      /V5Page02EvidenceQuestions is missing required snapshot data/,
    );
    expect(() => renderToStaticMarkup(createElement(V5Page03EvidenceTrail, { snapshot: baseProposal as never }))).toThrow(
      /V5Page03EvidenceTrail is missing required snapshot data/,
    );
    expect(() => renderToStaticMarkup(createElement(V5Page04CommercialDiagnosis, { snapshot: baseProposal as never }))).toThrow(
      /V5Page04CommercialDiagnosis is missing required snapshot data/,
    );
    expect(() => renderToStaticMarkup(createElement(V5Page05PartnerProposition, { snapshot: baseProposal as never }))).toThrow(
      /V5Page05PartnerProposition is missing required snapshot data/,
    );
  });

  it("does not render fallback or structural placeholder copy on Pages 02-05", () => {
    const snapshot = buildSnapshot();
    const html = [V5Page02EvidenceQuestions, V5Page03EvidenceTrail, V5Page04CommercialDiagnosis, V5Page05PartnerProposition]
      .map((Component) => renderToStaticMarkup(createElement(Component, { snapshot })))
      .join("");

    expect(html).not.toMatch(/fallback/i);
    expect(html).not.toMatch(/placeholder/i);
    expect(html).not.toMatch(/to be agreed/i);
    expect(html).not.toMatch(/structure/i);
    expect(html).not.toMatch(/localhost/i);
  });

  it("renders Pages 01-10 together with the approved order and phase page count", () => {
    const snapshot = buildSnapshot();
    const pageComponents = [
      V5Page01Cover,
      V5Page02EvidenceQuestions,
      V5Page03EvidenceTrail,
      V5Page04CommercialDiagnosis,
      V5Page05PartnerProposition,
      V5Page06SystemsFit,
      V5Page07DemandProgression,
      V5Page08ResponseOwnership,
      V5Page09PostBooking,
      V5Page10CommercialAccountability,
    ];
    const html = pageComponents.map((Component) => renderToStaticMarkup(createElement(Component, { snapshot }))).join("");

    expect(html.match(/data-v5-page-id=/g)).toHaveLength(10);
    expect(html).toContain('data-v5-page-id="V5Page06SystemsFit"');
    expect(html).toContain('data-v5-page-id="V5Page07DemandProgression"');
    expect(html).toContain('data-v5-page-id="V5Page08ResponseOwnership"');
    expect(html).toContain('data-v5-page-id="V5Page09PostBooking"');
    expect(html).toContain('data-v5-page-id="V5Page10CommercialAccountability"');
    expect(html).not.toContain('data-v5-page-id="V5Page11OSCapability"');
    expect(html.match(/width:210mm;height:297mm/g)).toHaveLength(10);
    expect(html).toContain('data-v5-page-number="10"');
    expect(html).toContain('data-v5-page-theme="dark"');
    expect(html).toContain('data-v5-page-theme="light"');
  });

  it("renders Page 06 from systems, priority journey and sector asset data", () => {
    const snapshot = buildSnapshot();
    const html = renderToStaticMarkup(createElement(V5Page06SystemsFit, { snapshot }));

    expect(getV5Page06MissingFields(snapshot)).toEqual([]);
    expect(html).toContain("Fits your current systems. Configured for dental practices.");
    expect(html).toContain("Known source systems.");
    expect(html).toContain("Build around Implants first.");
    expect(html).toContain("/brand/proposal/v5-reference/dental_practices/p06-img01-1009x1559.png");
  });

  it("renders Page 07 from clinic variant demand/progression data without changing package selection", () => {
    const snapshot = buildSnapshot();
    const html = renderToStaticMarkup(createElement(V5Page07DemandProgression, { snapshot }));

    expect(getV5Page07MissingFields(snapshot)).toEqual([]);
    expect(snapshot.selectedPackage.id).toBe("package-performance-os");
    expect(html).toContain("Does the next pound belong in demand, or patient progression?");
    expect(html).toContain("Are implant and aligner patients finding the practice?");
    expect(html).toContain("Do enquiries become attended consultations and accepted cases?");
    expect(html).toContain("Working start - progression");
    expect(html).toContain("/brand/proposal/v5-reference/dental_practices/p07-img01-1440x662.png");
    expect(html).toContain("Know whether to increase, repair or hold spend.");
  });

  it("stops Page 07 when the active constraint is not mapped to the snapshot journey", () => {
    const snapshot = buildSnapshot({
      ...baseProposal,
      sectionContent: {
        ...baseProposal.sectionContent,
        activeConstraintId: "unmapped response issue",
      },
    });

    expect(getV5Page07MissingFields(snapshot)).toContain("journey.activeConstraint.value matching journey.stages");
    expect(() => renderToStaticMarkup(createElement(V5Page07DemandProgression, { snapshot }))).toThrow(
      /journey.activeConstraint.value matching journey.stages/,
    );
  });

  it("renders Page 08 as response ownership evidence states rather than invented performance data", () => {
    const snapshot = buildSnapshot();
    const html = renderToStaticMarkup(createElement(V5Page08ResponseOwnership, { snapshot }));

    expect(getV5Page08MissingFields(snapshot)).toEqual([]);
    expect(html).toContain("A new implant enquiry has landed. Who owns the response?");
    expect(html).toContain("Evidence state - not clinic performance");
    expect(html).toContain("Implants");
    expect(html).toContain("Invisalign");
    expect(html).toContain("Composite bonding");
    expect(html).toContain("Working diagnosis");
    expect(html).not.toContain("148 min");
    expect(html).not.toContain("42%");
    expect(html).not.toContain("Leah");
    expect(html).not.toContain("09:00");
  });

  it("renders Page 09 from post-booking screenshot and sector continuation data", () => {
    const snapshot = buildSnapshot();
    const html = renderToStaticMarkup(createElement(V5Page09PostBooking, { snapshot }));

    expect(getV5Page09MissingFields(snapshot)).toEqual([]);
    expect(html).toContain("Beyond the booking");
    expect(html).toContain("coordinator review, consultation, treatment plan, follow-up and accepted case value");
    expect(html).toContain("/brand/proposal/v5-reference/dental_practices/p09-img01-1440x742.png");
    expect(html).toContain("A booking is not revenue.");
  });

  it("renders Page 10 from clinical boundary and sector proof image data", () => {
    const snapshot = buildSnapshot();
    const html = renderToStaticMarkup(createElement(V5Page10CommercialAccountability, { snapshot }));

    expect(getV5Page10MissingFields(snapshot)).toEqual([]);
    expect(html).toContain("Care stays with the clinic");
    expect(html).toContain("Diagnosis, consent and clinical treatment planning remain with the dental team.");
    expect(html).toContain("/brand/proposal/v5-reference/dental_practices/p10-img01-1122x1402.png");
    expect(html).not.toMatch(/ROI|return on investment|guarantee/i);
  });

  it("rejects raw proposal records at the Page 06-10 boundaries", () => {
    expect(() => renderToStaticMarkup(createElement(V5Page06SystemsFit, { snapshot: baseProposal as never }))).toThrow(
      /V5Page06SystemsFit is missing required snapshot data/,
    );
    expect(() => renderToStaticMarkup(createElement(V5Page07DemandProgression, { snapshot: baseProposal as never }))).toThrow(
      /V5Page07DemandProgression is missing required snapshot data/,
    );
    expect(() => renderToStaticMarkup(createElement(V5Page08ResponseOwnership, { snapshot: baseProposal as never }))).toThrow(
      /V5Page08ResponseOwnership is missing required snapshot data/,
    );
    expect(() => renderToStaticMarkup(createElement(V5Page09PostBooking, { snapshot: baseProposal as never }))).toThrow(
      /V5Page09PostBooking is missing required snapshot data/,
    );
    expect(() => renderToStaticMarkup(createElement(V5Page10CommercialAccountability, { snapshot: baseProposal as never }))).toThrow(
      /V5Page10CommercialAccountability is missing required snapshot data/,
    );
  });

  it("does not render fallback or structural placeholder copy on Pages 06-10", () => {
    const snapshot = buildSnapshot();
    const html = [
      V5Page06SystemsFit,
      V5Page07DemandProgression,
      V5Page08ResponseOwnership,
      V5Page09PostBooking,
      V5Page10CommercialAccountability,
    ].map((Component) => renderToStaticMarkup(createElement(Component, { snapshot }))).join("");

    expect(html).not.toMatch(/fallback/i);
    expect(html).not.toMatch(/placeholder/i);
    expect(html).not.toMatch(/to be agreed/i);
    expect(html).not.toMatch(/structure/i);
    expect(html).not.toMatch(/localhost/i);
  });

  it("renders Pages 01-15 together with the approved order and phase page count", () => {
    const snapshot = buildSnapshot();
    const pageComponents = [
      V5Page01Cover,
      V5Page02EvidenceQuestions,
      V5Page03EvidenceTrail,
      V5Page04CommercialDiagnosis,
      V5Page05PartnerProposition,
      V5Page06SystemsFit,
      V5Page07DemandProgression,
      V5Page08ResponseOwnership,
      V5Page09PostBooking,
      V5Page10CommercialAccountability,
      V5Page11OSCapability,
      V5Page12BreakEven,
      V5Page13Implementation,
      V5Page14OperatingRhythm,
      V5Page15ScopeMatrix,
    ];
    const html = pageComponents.map((Component) => renderToStaticMarkup(createElement(Component, { snapshot }))).join("");

    expect(html.match(/data-v5-page-id=/g)).toHaveLength(15);
    expect(html).toContain('data-v5-page-id="V5Page11OSCapability"');
    expect(html).toContain('data-v5-page-id="V5Page12BreakEven"');
    expect(html).toContain('data-v5-page-id="V5Page13Implementation"');
    expect(html).toContain('data-v5-page-id="V5Page14OperatingRhythm"');
    expect(html).toContain('data-v5-page-id="V5Page15ScopeMatrix"');
    expect(html).not.toContain('data-v5-page-id="V5Page16Responsibilities"');
    expect(html.match(/width:210mm;height:297mm/g)).toHaveLength(15);
    expect(html).toContain('data-v5-page-number="15"');
    expect(html).toContain('data-v5-page-theme="dark"');
    expect(html).toContain('data-v5-page-theme="light"');
  });

  it("renders Page 11 as the bounded OS capability layer from snapshot context", () => {
    const snapshot = buildSnapshot();
    const html = renderToStaticMarkup(createElement(V5Page11OSCapability, { snapshot }));

    expect(getV5Page11MissingFields(snapshot)).toEqual([]);
    expect(html).toContain('data-v5-page-theme="dark"');
    expect(html).toContain("The complete operating layer");
    expect(html).toContain("One Growth Operating System - useful when evidence is connected.");
    expect(html).toContain("Attribution and recorded value where supported");
    expect(html).toContain("Developing capability; human review is required.");
    expect(html).toContain("Availability depends on agreed scope, supported connections, permissions and data quality.");
  });

  it("calculates Page 12 break-even deterministically from approved snapshot values", () => {
    const snapshot = buildSnapshot();
    const calculation = calculateProposalV5BreakEven(snapshot);

    expect(calculation.canCalculate).toBe(true);
    expect(calculation.contributionCents).toBe(300_000);
    expect(calculation.relevantMonthlyInvestmentCents).toBe(249_500);
    expect(calculation.recurringBreakEvenUnits).toBe(1);
    expect(calculation.firstMonthBreakEvenUnits).toBe(1);
    expect(calculation.missingFields).toEqual([]);
  });

  it("renders Page 12 with blanks when commercial inputs are not known", () => {
    const snapshot = buildSnapshot({
      ...baseProposal,
      sectionContent: {
        ...baseProposal.sectionContent,
        contributionConfirmationState: "to_confirm",
      },
    });
    const html = renderToStaticMarkup(createElement(V5Page12BreakEven, { snapshot }));
    const calculation = calculateProposalV5BreakEven(snapshot);

    expect(getV5Page12MissingFields(snapshot)).toEqual([]);
    expect(calculation.canCalculate).toBe(false);
    expect(calculation.missingFields).toContain("economics.contribution.state");
    expect(html).toContain("\u00a3 ______ contribution");
    expect(html).toContain("To confirm.");
    expect(html).toContain("______");
  });

  it("keeps Page 12 commercial values blank when economics are known but relevant proof is not ready", () => {
    const snapshot = buildSnapshot({
      ...baseProposal,
      sectionContent: {
        ...baseProposal.sectionContent,
        proofAssets: [],
      },
    });
    const html = renderToStaticMarkup(createElement(V5Page12BreakEven, { snapshot }));
    const calculation = calculateProposalV5BreakEven(snapshot);

    expect(calculation.canCalculate).toBe(true);
    expect(snapshot.readiness.breakEven.canDisplayValues).toBe(false);
    expect(snapshot.readiness.breakEven.missingFields).toContain("proof.selected");
    expect(html).toContain("\u00a3 ______ contribution");
    expect(html).toContain("\u00a3 ______ investment");
    expect(html).not.toContain("\u00a33,000 contribution");
    expect(html).not.toContain("\u00a32,495 investment");
  });

  it("renders Page 12 known calculation without manufacturing ROI or conversion assumptions", () => {
    const snapshot = buildSnapshot();
    const html = renderToStaticMarkup(createElement(V5Page12BreakEven, { snapshot }));

    expect(getV5Page12MissingFields(snapshot)).toEqual([]);
    expect(html).toContain("Confirm the economics before any number becomes a promise.");
    expect(snapshot.readiness.breakEven.canDisplayValues).toBe(true);
    expect(html).toContain("\u00a33,000 contribution");
    expect(html).toContain("\u00a32,495 investment");
    expect(html).toContain("additional accepted implant cases required");
    expect(html).not.toMatch(/ROI|return on investment|conversion rate/i);
  });

  it("renders Page 13 from implementation image, services, constraint and known capacity", () => {
    const snapshot = buildSnapshot();
    const html = renderToStaticMarkup(createElement(V5Page13Implementation, { snapshot }));

    expect(getV5Page13MissingFields(snapshot)).toEqual([]);
    expect(html).toContain("A controlled implementation - with a decision at every checkpoint.");
    expect(html).toContain("Connect agreed sources, confirm capacity and baseline Implants.");
    expect(html).toContain("Built around Implants and Invisalign, real capacity and the first verified constraint.");
    expect(html).toContain("/brand/proposal/v5-reference/dental_practices/p13-img01-1672x941.png");
  });

  it("stops Page 13 when capacity is not known", () => {
    const snapshot = buildSnapshot({
      ...baseProposal,
      sectionContent: {
        ...baseProposal.sectionContent,
        availableCommercialCapacity: null,
      },
    });

    expect(getV5Page13MissingFields(snapshot)).toContain("economics.capacity.value");
    expect(() => renderToStaticMarkup(createElement(V5Page13Implementation, { snapshot }))).toThrow(/economics.capacity.value/);
  });

  it("renders Page 14 with clinic-type operating rhythm from the variant layer", () => {
    const snapshot = buildSnapshot();
    const html = renderToStaticMarkup(createElement(V5Page14OperatingRhythm, { snapshot }));

    expect(getV5Page14MissingFields(snapshot)).toEqual([]);
    expect(html).toContain("The same evidence. The same owners. A decision at the right cadence.");
    expect(html).toContain("Reception and treatment coordinator sees overdue responses, follow-up and priority actions.");
    expect(html).toContain("The owner reviews treatment-plan acceptance and accepted case value, capacity and commercial sense.");
    expect(html).toContain("The scorecard exists to trigger a decision - not to decorate a dashboard.");
  });

  it("renders Page 15 from package scope held in the snapshot", () => {
    const snapshot = buildSnapshot();
    const html = renderToStaticMarkup(createElement(V5Page15ScopeMatrix, { snapshot }));

    expect(getV5Page15MissingFields(snapshot)).toEqual([]);
    expect(html).not.toContain("package-performance-os");
    expect(html).toContain("Exactly what the selected route includes.");
    expect(html).toContain("Performance-led growth management");
    expect(html).toContain("Google Ads management");
    expect(html).toContain("SEO and Google Business Profile management");
    expect(html).toContain("Conversion and landing page optimisation");
    expect(html).toContain("Full OS and reporting");
    expect(html).toContain("Scope item");
    expect(html).toContain("Responsibility");
    expect(html).toContain("Implants, Invisalign and composite bonding for the Bristol practice");
    expect(html).toContain("Google Ads media spend is paid separately");
    expect(html).not.toContain("Stored scope wording supplied by proposal data.");
  });

  it("keeps Page 15 package scope independent from clinic type", () => {
    const dentalSnapshot = buildSnapshot();
    const aestheticsSnapshot = buildSnapshot({
      ...baseProposal,
      sectionContent: {
        ...baseProposal.sectionContent,
        clinicTypeVariant: "aesthetic_clinic",
      },
    });
    const growthEngineSnapshot = buildSnapshot({
      ...baseProposal,
      sectionContent: {
        ...baseProposal.sectionContent,
        scopeItems: [
          {
            category: "Operating System",
            title: "Growth Engine scope line",
            clientDescription: "Stored Growth Engine scope wording supplied by proposal data.",
            frequency: "Weekly",
            quantityLimit: "Managed growth journey",
            treatmentsAndLocations: "Selected priority journey",
            dependencies: "Approved paid media and source access.",
            clientResponsibilities: "Approve media plan",
            exclusions: "additional locations",
            thirdPartyCosts: "Paid media remains separate",
            inclusionStatus: "included",
            deliveryType: "recurring",
            isOptionalAddOn: false,
            approvalStatus: "not_required",
            sortOrder: 10,
          },
        ],
      },
    }, {
      ...basePackage,
      id: "package-growth-engine",
      name: "Growth Engine",
      priceCents: 199_500,
    });

    expect(aestheticsSnapshot.clinic.clinicType).toBe("aesthetic_clinic");
    expect(aestheticsSnapshot.selectedPackage.id).toBe(dentalSnapshot.selectedPackage.id);
    expect(aestheticsSnapshot.scope.map((line) => line.title)).toEqual(dentalSnapshot.scope.map((line) => line.title));
    expect(growthEngineSnapshot.clinic.clinicType).toBe("dental_clinic");
    expect(growthEngineSnapshot.selectedPackage.id).toBe("package-growth-engine");
    expect(growthEngineSnapshot.scope.map((line) => line.title)).toEqual(["Growth Engine scope line"]);
  });

  it("rejects raw proposal records at the Page 11-15 boundaries", () => {
    expect(() => renderToStaticMarkup(createElement(V5Page11OSCapability, { snapshot: baseProposal as never }))).toThrow(
      /V5Page11OSCapability is missing required snapshot data/,
    );
    expect(() => renderToStaticMarkup(createElement(V5Page12BreakEven, { snapshot: baseProposal as never }))).toThrow(
      /V5Page12BreakEven is missing required snapshot data/,
    );
    expect(() => renderToStaticMarkup(createElement(V5Page13Implementation, { snapshot: baseProposal as never }))).toThrow(
      /V5Page13Implementation is missing required snapshot data/,
    );
    expect(() => renderToStaticMarkup(createElement(V5Page14OperatingRhythm, { snapshot: baseProposal as never }))).toThrow(
      /V5Page14OperatingRhythm is missing required snapshot data/,
    );
    expect(() => renderToStaticMarkup(createElement(V5Page15ScopeMatrix, { snapshot: baseProposal as never }))).toThrow(
      /V5Page15ScopeMatrix is missing required snapshot data/,
    );
  });

  it("does not render fallback or structural placeholder copy on Pages 11-15", () => {
    const snapshot = buildSnapshot();
    const html = [
      V5Page11OSCapability,
      V5Page12BreakEven,
      V5Page13Implementation,
      V5Page14OperatingRhythm,
      V5Page15ScopeMatrix,
    ].map((Component) => renderToStaticMarkup(createElement(Component, { snapshot }))).join("");

    expect(html).not.toMatch(/fallback/i);
    expect(html).not.toMatch(/placeholder/i);
    expect(html).not.toMatch(/to be agreed/i);
    expect(html).not.toMatch(/structure/i);
      expect(html).not.toMatch(/localhost/i);
    });

  it("renders Pages 01-19 together with the approved order and final page count", () => {
    const snapshot = buildSnapshot();
    const html = renderToStaticMarkup(createElement(ProposalV5Renderer, { snapshot }));

    expect(html.match(/data-v5-page-id=/g)).toHaveLength(19);
    expect(html.match(/width:210mm;height:297mm/g)).toHaveLength(19);
    expect(html).toContain('data-v5-page-id="V5Page16Responsibilities"');
    expect(html).toContain('data-v5-page-id="V5Page17Proof"');
    expect(html).toContain('data-v5-page-id="V5Page18Investment"');
    expect(html).toContain('data-v5-page-id="V5Page19Close"');
    expect(html).toContain('data-v5-page-number="19"');
    expect(html).not.toContain('data-v5-page-number="20"');
    expect(html).not.toMatch(/structural placeholder|data-v5-structural-placeholder|fallback|localhost/i);
    expect(html).not.toContain(snapshot.sourceProposalVersion);
    expect(html).not.toContain(snapshot.snapshotHash);
    expect(html).not.toContain("package-performance-os");
  });

  it("renders Page 16 from accepted scope responsibilities and dependencies", () => {
    const snapshot = buildSnapshot();
    const html = renderToStaticMarkup(createElement(V5Page16Responsibilities, { snapshot }));

    expect(getV5Page16MissingFields(snapshot)).toEqual([]);
    expect(html).toContain("Clear responsibilities before the work begins.");
    expect(html).toContain("Delivery of the accepted scope.");
    expect(html).toContain("Confirm source access.");
    expect(html).toContain("Clinic funds media directly and approves claims.");
    expect(html).toContain("custom development");
    expect(html).not.toMatch(/SLA|guarantee|unlimited/i);
  });

  it("renders Page 17 only from known proof with source, timeframe and disclaimer provenance", () => {
    const proofAssets = baseProposal.sectionContent?.proofAssets || [];
    const snapshot = buildSnapshot({
      ...baseProposal,
      sectionContent: {
        ...baseProposal.sectionContent,
        proofAssets: [
          ...proofAssets,
          {
            id: "inactive-proof",
            type: "performance_result",
            title: "Inactive claim",
            copy: "This should not render.",
            mediaUrl: null,
            sectorTags: [
              "dental",
              "state:known",
              "source:Inactive library",
              "timeframe:Inactive",
              "disclaimer:Inactive",
            ],
            sortOrder: 70,
            isActive: false,
            createdAt: "2026-08-10T09:00:00.000Z",
            updatedAt: "2026-08-10T09:00:00.000Z",
          },
        ],
      },
    });
    const html = renderToStaticMarkup(createElement(V5Page17Proof, { snapshot }));

    expect(getV5Page17MissingFields(snapshot)).toEqual([]);
    expect(snapshot.proof.every((asset) => asset.state === "known")).toBe(true);
    expect(html).toContain("Cross-sector company delivery proof - not same-sector or OS results");
    expect(html).toContain("+262.73%");
    expect(html).toContain("Dr Tanja Phillips");
    expect(html).toContain("ClinicGrower approved proof library");
    expect(html).toContain("Documented delivery period");
    expect(html).toContain("not a ClinicGrower OS guarantee");
    expect(html).not.toContain("Inactive claim");
  });

  it("renders every Page 17 proof with its own corresponding media", () => {
    const pairedProofAssets = [
      {
        id: "proof-award-pair",
        type: "award",
        title: "Best Clinic Growth Award",
        copy: "Award recognition details for this proof block.",
        mediaUrl: "/brand/proof/award-x.webp",
        sectorTags: [
          "dental",
          "state:known",
          "source:ClinicGrower awards library",
          "timeframe:2026",
          "disclaimer:Award proof is a credibility signal, not a guarantee.",
        ],
        sortOrder: 1,
        isActive: true,
        createdAt: "2026-08-10T09:00:00.000Z",
        updatedAt: "2026-08-10T09:00:00.000Z",
      },
      {
        id: "proof-result-pair-a",
        type: "performance_result",
        title: "Lead conversion improvement",
        copy: "Result proof with its own evidence image.",
        mediaUrl: "/brand/proof/result-a.webp",
        sectorTags: [
          "dental",
          "state:known",
          "proof_scope:Dental delivery proof with documented delivery context.",
          "source:ClinicGrower proof library",
          "timeframe:90 days",
          "disclaimer:Historical result is contextual and not a guarantee.",
        ],
        sortOrder: 2,
        isActive: true,
        createdAt: "2026-08-10T09:00:00.000Z",
        updatedAt: "2026-08-10T09:00:00.000Z",
      },
      {
        id: "proof-result-pair-b",
        type: "performance_result",
        title: "Cost-per-enquiry reduction",
        copy: "Second result proof with its own evidence image.",
        mediaUrl: "/brand/proof/result-b.webp",
        sectorTags: [
          "dental",
          "state:known",
          "proof_scope:Dental delivery proof with documented delivery context.",
          "source:ClinicGrower proof library",
          "timeframe:90 days",
          "disclaimer:Historical result is contextual and not a guarantee.",
        ],
        sortOrder: 3,
        isActive: true,
        createdAt: "2026-08-10T09:00:00.000Z",
        updatedAt: "2026-08-10T09:00:00.000Z",
      },
      {
        id: "proof-result-pair-c",
        type: "performance_result",
        title: "Consultation demand increase",
        copy: "Third result proof with its own evidence image.",
        mediaUrl: "/brand/proof/result-c.webp",
        sectorTags: [
          "dental",
          "state:known",
          "proof_scope:Dental delivery proof with documented delivery context.",
          "source:ClinicGrower proof library",
          "timeframe:90 days",
          "disclaimer:Historical result is contextual and not a guarantee.",
        ],
        sortOrder: 4,
        isActive: true,
        createdAt: "2026-08-10T09:00:00.000Z",
        updatedAt: "2026-08-10T09:00:00.000Z",
      },
      {
        id: "proof-testimonial-pair",
        type: "testimonial",
        title: "Clinic owner testimonial",
        copy: "Permissioned testimonial proof.",
        mediaUrl: "/brand/proof/testimonial-x.webp",
        sectorTags: [
          "dental",
          "state:known",
          "source:ClinicGrower testimonial library",
          "timeframe:Permissioned testimonial",
          "disclaimer:Named testimonial is used only where permission exists.",
        ],
        sortOrder: 5,
        isActive: true,
        createdAt: "2026-08-10T09:00:00.000Z",
        updatedAt: "2026-08-10T09:00:00.000Z",
      },
      {
        id: "proof-video-pair",
        type: "testimonial_video",
        title: "Founder video proof",
        copy: "Video proof with its own thumbnail.",
        mediaUrl: "/brand/proof/video-thumb-x.webp",
        sectorTags: [
          "dental",
          "state:known",
          "source:ClinicGrower video library",
          "timeframe:Permissioned video asset",
          "disclaimer:Video proof is contextual and is not a guaranteed outcome.",
        ],
        sortOrder: 6,
        isActive: true,
        createdAt: "2026-08-10T09:00:00.000Z",
        updatedAt: "2026-08-10T09:00:00.000Z",
      },
      {
        id: "proof-case-study-pair",
        type: "case_study",
        title: "Clinic X case study",
        copy: "Case-study content paired with its own image.",
        mediaUrl: "/brand/proof/case-study-x.webp",
        sectorTags: [
          "dental",
          "state:known",
          "source:ClinicGrower case-study library",
          "timeframe:Documented delivery period",
          "disclaimer:Case-study evidence is contextual and does not imply a guaranteed outcome.",
        ],
        sortOrder: 7,
        isActive: true,
        createdAt: "2026-08-10T09:00:00.000Z",
        updatedAt: "2026-08-10T09:00:00.000Z",
      },
      {
        id: "proof-product-pair",
        type: "product_screenshot",
        title: "ClinicGrower OS screenshot",
        copy: "ClinicGrower OS product proof paired with its own screenshot.",
        mediaUrl: "/brand/proof/os-screenshot-x.webp",
        sectorTags: [
          "dental",
          "clinicgrower os",
          "product screenshot",
          "state:known",
          "source:ClinicGrower OS product screenshot library",
          "timeframe:Current V5 product reference",
          "disclaimer:Product screenshot is illustrative where supported sources are connected.",
        ],
        sortOrder: 8,
        isActive: true,
        createdAt: "2026-08-10T09:00:00.000Z",
        updatedAt: "2026-08-10T09:00:00.000Z",
      },
    ];
    const snapshot = buildSnapshot({
      ...baseProposal,
      sectionContent: {
        ...baseProposal.sectionContent,
        proofAssets: pairedProofAssets,
      },
    } as ProposalPublicRecord);
    const html = renderToStaticMarkup(createElement(V5Page17Proof, { snapshot }));

    expect(getProposalV5ProofReadinessMissingFields(snapshot)).toEqual([]);
    for (const [title, expectedUrl, wrongUrl] of [
      ["Best Clinic Growth Award", "/brand/proof/award-x.webp", "/brand/proof/case-study-x.webp"],
      ["Clinic X case study", "/brand/proof/case-study-x.webp", "/brand/proof/award-x.webp"],
      ["Lead conversion improvement", "/brand/proof/result-a.webp", "/brand/proof/result-b.webp"],
      ["Clinic owner testimonial", "/brand/proof/testimonial-x.webp", "/brand/proof/video-thumb-x.webp"],
      ["Founder video proof", "/brand/proof/video-thumb-x.webp", "/brand/proof/testimonial-x.webp"],
      ["ClinicGrower OS screenshot", "/brand/proof/os-screenshot-x.webp", "/brand/proof/testimonial-x.webp"],
    ] as const) {
      const proofPair = extractProofPair(html, title);
      expect(proofPair).toContain(expectedUrl);
      expect(proofPair).not.toContain(wrongUrl);
    }
  });

  it("renders all selected Page 17 proofs and keeps readiness separate from media availability", () => {
    const selectedProofAssets = [
      {
        id: "proof-selected-award-a",
        type: "award",
        title: "Aesthetics Awards recognition",
        copy: "Award recognition details for the proposal proof band.",
        mediaUrl: "/brand/proof/award-a.webp",
        sectorTags: [
          "state:known",
          "source:ClinicGrower awards library",
          "timeframe:2025",
          "disclaimer:Award proof is a credibility signal, not a guarantee.",
        ],
        sortOrder: 1,
        isActive: true,
        createdAt: "2026-08-10T09:00:00.000Z",
        updatedAt: "2026-08-10T09:00:00.000Z",
      },
      {
        id: "proof-selected-award-b",
        type: "award",
        title: "2026 service provider finalist",
        copy: "Second award proof selected without a media asset.",
        mediaUrl: null,
        sectorTags: [
          "state:known",
          "source:ClinicGrower awards library",
          "timeframe:2026",
          "disclaimer:Award proof is contextual and not a guaranteed outcome.",
        ],
        sortOrder: 2,
        isActive: true,
        createdAt: "2026-08-10T09:00:00.000Z",
        updatedAt: "2026-08-10T09:00:00.000Z",
      },
      {
        id: "proof-selected-case",
        type: "case_study",
        title: "Dental booked-consultation case study",
        copy: "Permission approved dental case study with documented delivery context.",
        mediaUrl: "/brand/proof/dental-case-study.webp",
        sectorTags: [
          "dental",
          "state:known",
          "source:ClinicGrower case-study library",
          "timeframe:Documented delivery period",
          "disclaimer:Case-study evidence is contextual and does not imply a guaranteed outcome.",
        ],
        sortOrder: 3,
        isActive: true,
        createdAt: "2026-08-10T09:00:00.000Z",
        updatedAt: "2026-08-10T09:00:00.000Z",
      },
      {
        id: "proof-selected-testimonial",
        type: "testimonial",
        title: "Named dental owner testimonial",
        copy: "Permission approved testimonial from a dental clinic owner.",
        mediaUrl: null,
        sectorTags: [
          "dental",
          "state:known",
          "source:ClinicGrower testimonial library",
          "timeframe:Permission approved testimonial",
          "disclaimer:Named testimonial is used only where permission exists.",
        ],
        sortOrder: 4,
        isActive: true,
        createdAt: "2026-08-10T09:00:00.000Z",
        updatedAt: "2026-08-10T09:00:00.000Z",
      },
      {
        id: "proof-selected-video",
        type: "testimonial_video",
        title: "Founder proof video",
        copy: "Permission approved video proof with no separate thumbnail selected.",
        mediaUrl: null,
        sectorTags: [
          "dental",
          "state:known",
          "source:ClinicGrower video library",
          "timeframe:Permission approved video asset",
          "disclaimer:Video proof is contextual and is not a guaranteed outcome.",
        ],
        sortOrder: 5,
        isActive: true,
        createdAt: "2026-08-10T09:00:00.000Z",
        updatedAt: "2026-08-10T09:00:00.000Z",
      },
      {
        id: "proof-selected-result-a",
        type: "performance_result",
        title: "Booked consultation visibility result",
        copy: "Over 90 days, the clinic gained clearer enquiry and booking accountability.",
        mediaUrl: "/brand/proof/result-selected-a.webp",
        sectorTags: [
          "dental",
          "state:known",
          "proof_scope:Dental delivery proof with documented delivery context.",
          "source:ClinicGrower proof library",
          "timeframe:90 days",
          "disclaimer:Historical result is contextual and not a guarantee.",
        ],
        sortOrder: 6,
        isActive: true,
        createdAt: "2026-08-10T09:00:00.000Z",
        updatedAt: "2026-08-10T09:00:00.000Z",
      },
      {
        id: "proof-selected-result-b",
        type: "performance_result",
        title: "Response ownership result",
        copy: "Within 60 days, follow-up ownership was clearer against the selected journey.",
        mediaUrl: null,
        sectorTags: [
          "dental",
          "state:known",
          "proof_scope:Dental delivery proof with documented delivery context.",
          "source:ClinicGrower proof library",
          "timeframe:60 days",
          "disclaimer:Historical result is contextual and not a guarantee.",
        ],
        sortOrder: 7,
        isActive: true,
        createdAt: "2026-08-10T09:00:00.000Z",
        updatedAt: "2026-08-10T09:00:00.000Z",
      },
      {
        id: "proof-selected-product",
        type: "product_screenshot",
        title: "ClinicGrower OS dental performance view",
        copy: "ClinicGrower OS screenshot showing enquiry, booking and next-action visibility where connected.",
        mediaUrl: "/brand/proof/os-selected-screenshot.webp",
        sectorTags: [
          "dental",
          "clinicgrower os",
          "product screenshot",
          "state:known",
          "source:ClinicGrower OS product screenshot library",
          "timeframe:Current V5 product reference",
          "disclaimer:Product screenshot is illustrative where supported sources are connected.",
        ],
        sortOrder: 8,
        isActive: true,
        createdAt: "2026-08-10T09:00:00.000Z",
        updatedAt: "2026-08-10T09:00:00.000Z",
      },
      {
        id: "proof-selected-logo",
        type: "client_logo",
        title: "Client logo proof block",
        copy: "Approved client logo proof selected without a separate media asset.",
        mediaUrl: null,
        sectorTags: [
          "state:known",
          "source:ClinicGrower proof library",
          "timeframe:Current proof library",
          "disclaimer:Logo proof is a credibility signal, not a guaranteed outcome.",
        ],
        sortOrder: 9,
        isActive: true,
        createdAt: "2026-08-10T09:00:00.000Z",
        updatedAt: "2026-08-10T09:00:00.000Z",
      },
      {
        id: "proof-selected-team",
        type: "team_image",
        title: "ClinicGrower team image",
        copy: "Team proof selected without a separate media asset.",
        mediaUrl: null,
        sectorTags: [
          "state:known",
          "source:ClinicGrower proof library",
          "timeframe:Current team proof library",
          "disclaimer:Team proof introduces the delivery context and is not a guaranteed outcome.",
        ],
        sortOrder: 10,
        isActive: true,
        createdAt: "2026-08-10T09:00:00.000Z",
        updatedAt: "2026-08-10T09:00:00.000Z",
      },
    ];
    const snapshot = buildSnapshot({
      ...baseProposal,
      sectionContent: {
        ...baseProposal.sectionContent,
        proofAssets: selectedProofAssets,
      },
    } as ProposalPublicRecord);
    const html = renderToStaticMarkup(createElement(V5Page17Proof, { snapshot }));

    expect(snapshot.proof).toHaveLength(10);
    expect(getProposalV5ProofReadinessMissingFields(snapshot)).toEqual([]);
    expect(html).not.toContain("No relevant proof assets are selected");
    expect(html).not.toContain('data-v5-proof-status="not-ready"');

    selectedProofAssets.forEach((asset) => {
      expect(html).toContain(asset.title);
      const pair = extractProofPair(html, asset.title);
      if (asset.mediaUrl) {
        expect(pair).toContain(asset.mediaUrl);
      } else {
        expect(pair).toContain("Evidence summary");
        expect(pair).not.toContain("/brand/proof/award-a.webp");
        expect(pair).not.toContain("/brand/proof/dental-case-study.webp");
      }
    });
  });

  it("keeps Page 17 safe when no proof is selected", () => {
    const snapshot = buildSnapshot({
      ...baseProposal,
      sectionContent: {
        ...baseProposal.sectionContent,
        proofAssets: [],
      },
    } as ProposalPublicRecord);
    const html = renderToStaticMarkup(createElement(V5Page17Proof, { snapshot }));

    expect(snapshot.proof).toHaveLength(0);
    expect(html).toContain('data-v5-page-17-proof-count="0"');
    expect(html).toContain('data-v5-page-17-density="editorial"');
    expect(html).toContain('data-v5-proof-status="not-ready"');
    expect((html.match(/data-v5-proof-pair/g) || [])).toHaveLength(0);
  });

  it.each([
    [1, "editorial"],
    [2, "editorial"],
    [3, "balanced"],
    [5, "compact"],
    [8, "compact"],
    [10, "dense"],
    [12, "dense"],
    [20, "maximum"],
  ])("keeps Page 17 bounded and represented with %i selected proofs", (count, expectedDensity) => {
    const proofAssets = proofAssetsForCount(count);
    const snapshot = buildSnapshot({
      ...baseProposal,
      sectionContent: {
        ...baseProposal.sectionContent,
        proofAssets,
      },
    } as ProposalPublicRecord);
    const html = renderToStaticMarkup(createElement(V5Page17Proof, { snapshot }));

    expect(snapshot.proof).toHaveLength(count);
    expect(html).toContain(`data-v5-page-17-proof-count="${count}"`);
    expect(html).toContain(`data-v5-page-17-density="${expectedDensity}"`);
    expect(html).toContain(`data-v5-proof-count="${count}"`);
    expect(html).toContain(`data-v5-proof-density="${expectedDensity}"`);
    expect((html.match(/data-v5-proof-pair/g) || [])).toHaveLength(count);
    expect(html).not.toContain("No relevant proof assets are selected");
    expect(html).not.toContain('data-v5-proof-status="not-ready"');

    proofAssets.forEach((asset) => {
      expect(html).toContain(asset.title);
      const pair = extractProofPair(html, asset.title);
      if (asset.mediaUrl) {
        expect(pair).toContain(asset.mediaUrl);
      } else {
        expect(pair).toContain("Evidence summary");
      }
    });
  });

  it("keeps a 20-proof V5 proposal to the fixed 19-page structure", () => {
    const snapshot = buildSnapshot({
      ...baseProposal,
      sectionContent: {
        ...baseProposal.sectionContent,
        proofAssets: proofAssetsForCount(20),
      },
    } as ProposalPublicRecord);
    const html = renderToStaticMarkup(createElement(ProposalV5Renderer, { snapshot }));

    expect((html.match(/data-v5-page-id=/g) || [])).toHaveLength(19);
    expect(html).toContain('data-v5-page-id="V5Page17Proof"');
    expect(html).toContain('data-v5-page-17-density="maximum"');
    expect(html).not.toContain('data-v5-page-number="20"');
  });

  it("does not substitute another proof image when a proof media URL is missing", () => {
    const snapshot = buildSnapshot({
      ...baseProposal,
      sectionContent: {
        ...baseProposal.sectionContent,
        proofAssets: (baseProposal.sectionContent?.proofAssets || []).map((asset) =>
          asset.title === "+262.73%" ? { ...asset, mediaUrl: null } : asset,
        ),
      },
    });
    const html = renderToStaticMarkup(createElement(V5Page17Proof, { snapshot }));
    const resultProof = extractProofPair(html, "+262.73%");

    expect(resultProof).toContain("Evidence summary");
    expect(resultProof).not.toContain("/brand/proposal/v5-reference/dental_practices/p17-img02-2400x1350.png");
  });

  it("renders selected Page 17 proof even when proof provenance is incomplete", () => {
    const snapshot = buildSnapshot({
      ...baseProposal,
      sectionContent: {
        ...baseProposal.sectionContent,
        proofAssets: [
          {
            id: "weak-proof",
            type: "performance_result",
            title: "+10%",
            copy: "Unattributed proof.",
            mediaUrl: null,
            sectorTags: ["dental"],
            sortOrder: 10,
            isActive: true,
            createdAt: "2026-08-10T09:00:00.000Z",
            updatedAt: "2026-08-10T09:00:00.000Z",
          },
        ],
      },
    });
    const html = renderToStaticMarkup(createElement(V5Page17Proof, { snapshot }));

    expect(getV5Page17MissingFields(snapshot)).toEqual([]);
    expect(getProposalV5ProofReadinessMissingFields(snapshot)).toEqual(expect.arrayContaining([
      "proof.case_study",
      "proof.testimonial_or_video",
      "proof.product_screenshot_media",
      "proof.performance_result_context",
    ]));
    expect(html).not.toContain('data-v5-proof-status="not-ready"');
    expect(html).not.toContain("No relevant proof assets are selected");
    expect(html).toContain("+10%");
    expect(extractProofPair(html, "+10%")).toContain("Evidence summary");
  });

  it("does not erase selected proof assets that do not match the selected clinic type", () => {
    const snapshot = buildSnapshot({
      ...baseProposal,
      sectionContent: {
        ...baseProposal.sectionContent,
        clinicTypeVariant: "aesthetic_clinic",
      },
    });
    const html = renderToStaticMarkup(createElement(V5Page17Proof, { snapshot }));

    expect(snapshot.clinic.clinicType).toBe("aesthetic_clinic");
    expect(getProposalV5ProofReadinessMissingFields(snapshot)).toContain("proof.clinic_type_match");
    expect(html).not.toContain('data-v5-proof-status="not-ready"');
    expect(html).not.toContain("No relevant proof assets are selected");
    expect(html).toContain("Dr Tanja Phillips");
    expect(html).toContain("+262.73%");
  });

  it("keeps selected proof rendering independent from clinic type without changing the selected package", () => {
    const dentalSnapshot = buildSnapshot();
    const aestheticsSnapshot = buildSnapshot({
      ...baseProposal,
      sectionContent: {
        ...baseProposal.sectionContent,
        clinicTypeVariant: "aesthetic_clinic",
      },
    });
    const dentalHtml = renderToStaticMarkup(createElement(V5Page17Proof, { snapshot: dentalSnapshot }));
    const aestheticsHtml = renderToStaticMarkup(createElement(V5Page17Proof, { snapshot: aestheticsSnapshot }));

    expect(dentalSnapshot.selectedPackage.id).toBe(aestheticsSnapshot.selectedPackage.id);
    expect(dentalHtml).toContain("Dr Tanja Phillips");
    expect(aestheticsHtml).not.toContain("No relevant proof assets are selected");
    expect(aestheticsHtml).toContain("Dr Tanja Phillips");
    expect(getProposalV5ProofReadinessMissingFields(aestheticsSnapshot)).toContain("proof.clinic_type_match");
  });

  it("renders Page 18 investment from selected package and commercial snapshot values", () => {
    const snapshot = buildSnapshot();
    const html = renderToStaticMarkup(createElement(V5Page18Investment, { snapshot }));

    expect(getV5Page18MissingFields(snapshot)).toEqual([]);
    expect(html).toContain("grid-template-rows:auto auto auto auto auto");
    expect(html).toContain("min-height:17mm");
    expect(html).toContain(`color:${proposalV5Tokens.colors.muted}`);
    expect(html).toContain("One recommended route.");
    expect(html).toContain("Performance OS");
    expect(html).toContain("\u00a3995");
    expect(html).toContain("\u00a31,500 per month");
    expect(html).toContain("6 months");
    expect(html).toContain("30 days");
    expect(html).toContain("Start 1 September 2026; valid until 30 September 2026");
    expect(html).toContain("Decision point");
    expect(html).not.toContain("Growth Engine");
  });

  it("keeps Page 18 investment independent from clinic type and deterministic from package values", () => {
    const dentalSnapshot = buildSnapshot();
    const aestheticsSnapshot = buildSnapshot({
      ...baseProposal,
      sectionContent: {
        ...baseProposal.sectionContent,
        clinicTypeVariant: "aesthetic_clinic",
      },
    });
    const growthEngineSnapshot = buildSnapshot({
      ...baseProposal,
      packageName: "Growth Engine",
      monthlyFeeCents: 199_500,
      setupFeeCents: 99_500,
      sectionContent: {
        ...baseProposal.sectionContent,
        selectedMediaSpend: "3000",
      },
    }, {
      ...basePackage,
      id: "package-growth-engine",
      name: "Growth Engine",
      priceCents: 199_500,
      setupFeeCents: 99_500,
    });

    const dentalHtml = renderToStaticMarkup(createElement(V5Page18Investment, { snapshot: dentalSnapshot }));
    const aestheticsHtml = renderToStaticMarkup(createElement(V5Page18Investment, { snapshot: aestheticsSnapshot }));
    const growthEngineHtml = renderToStaticMarkup(createElement(V5Page18Investment, { snapshot: growthEngineSnapshot }));

    expect(aestheticsSnapshot.clinic.clinicType).toBe("aesthetic_clinic");
    expect(aestheticsSnapshot.selectedPackage.id).toBe(dentalSnapshot.selectedPackage.id);
    expect(dentalHtml).toContain("\u00a3995");
    expect(aestheticsHtml).toContain("\u00a3995");
    expect(growthEngineSnapshot.clinic.clinicType).toBe("dental_clinic");
    expect(growthEngineHtml).toContain("Growth Engine");
    expect(growthEngineHtml).toContain("\u00a31,995");
    expect(growthEngineHtml).toContain("\u00a33,000 per month");
    expect(growthEngineHtml).not.toContain("package-growth-engine");
  });

  it("renders Page 19 with customer-facing acceptance links and no internal metadata", () => {
    const snapshot = buildSnapshot();
    const html = renderToStaticMarkup(createElement(V5Page19Close, { snapshot }));

    expect(getV5Page19MissingFields(snapshot)).toEqual([]);
    expect(html).toContain("Ready to make the first growth journey accountable?");
    expect(html).toContain("Review and accept online");
    expect(html).toContain("Ask a question");
    expect(html).toContain("https://crm.clinicgrower.co.uk/proposals/accept/test");
    expect(html).toContain("https://crm.clinicgrower.co.uk/proposals/questions/test");
    expect(html).not.toContain(snapshot.sourceProposalVersion);
    expect(html).not.toContain(snapshot.snapshotHash);
    expect(html).not.toContain("package-performance-os");
    expect(html).not.toContain("data-proposal-v5");
    expect(html).not.toMatch(/internal id|implementation detail|accepted at/i);
  });

  it("rejects raw proposal records at the Page 16-19 boundaries", () => {
    expect(() => renderToStaticMarkup(createElement(V5Page16Responsibilities, { snapshot: baseProposal as never }))).toThrow(
      /V5Page16Responsibilities is missing required snapshot data/,
    );
    expect(() => renderToStaticMarkup(createElement(V5Page17Proof, { snapshot: baseProposal as never }))).toThrow(
      /V5Page17Proof is missing required snapshot data/,
    );
    expect(() => renderToStaticMarkup(createElement(V5Page18Investment, { snapshot: baseProposal as never }))).toThrow(
      /V5Page18Investment is missing required snapshot data/,
    );
    expect(() => renderToStaticMarkup(createElement(V5Page19Close, { snapshot: baseProposal as never }))).toThrow(
      /V5Page19Close is missing required snapshot data/,
    );
  });

  it("does not render fallback or structural placeholder copy on Pages 16-19", () => {
    const snapshot = buildSnapshot();
    const html = [
      V5Page16Responsibilities,
      V5Page17Proof,
      V5Page18Investment,
      V5Page19Close,
    ].map((Component) => renderToStaticMarkup(createElement(Component, { snapshot }))).join("");

    expect(html).not.toMatch(/fallback/i);
    expect(html).not.toMatch(/placeholder/i);
    expect(html).not.toMatch(/to be agreed/i);
    expect(html).not.toMatch(/structure/i);
    expect(html).not.toMatch(/localhost/i);
  });
});
