import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { v4 as uuidv4 } from "uuid";
import pool, { testConnection } from "../config/database.js";
import { contactsService } from "../modules/contacts/contacts.service.js";
import { pipelineDealsService } from "../modules/pipeline/pipeline.deals.service.js";
import proposalsRoutes from "../modules/proposals/proposals.routes.js";
import errorHandler from "../middleware/errorHandler.js";
import { generateToken, hashPassword } from "../utils/helpers.js";

type TestUser = { id: string; roleId: string; token: string };

const proposalClinicTypeAssetVersion = "2026-08-10.v5-approved-assets";

function makeReadySectionContent(proofAssetIds: string[]) {
  return {
    proposalReference: "CG-TEST-001",
    proposalDate: "2026-08-10",
    clinicTypeVariant: "dental_clinic",
    clinicTypeAssetVersion: proposalClinicTypeAssetVersion,
    personalIntroduction: "This proposal is focused on the confirmed dental growth gaps discussed during discovery.",
    primaryGoal: "Increase predictable private dental consultations and treatment-plan starts.",
    clinicTypeAndLocations: "Dental clinic with one main location and a defined local catchment.",
    currentPosition: "High-value demand exists, but source visibility, booking movement and follow-up need clearer accountability.",
    currentMarketingSpend: "1200 per month across paid search and local visibility.",
    currentWebsiteCrmBookingSetup: "Website forms, phone calls and booking records are available for connection where access is granted.",
    problemsDiscussed: "Missed calls, unclear treatment enquiry source and inconsistent follow-up after consultation requests.",
    whyActNow: "The clinic wants to protect high-value private treatment demand before increasing media spend.",
    currentlyUnmeasured: "Response speed, booking rate, attendance rate and treatment-plan acceptance by source.",
    availableCapacity: "The clinic can support five additional private consultations each month.",
    priorityTreatments: "Dental implants, Invisalign and private cosmetic dentistry.",
    targetArea: "Local dental catchment around the clinic.",
    desiredOutcome: "A clearer ClinicGrower OS growth system within the first 90 days.",
    biggestRisk: "High-value enquiries are being lost after the lead arrives.",
    biggestOpportunity: "A small improvement in booked implant and Invisalign consultations can cover the monthly fee.",
    firstRecommendedFix: "Connect enquiry sources, response ownership and booking outcomes before scaling spend.",
    currentMonthlyEnquiries: "40",
    currentMonthlyBookedPatients: "12",
    currentBookingRate: "30",
    attendanceRate: "80",
    consultationToTreatmentConversionRate: "45",
    averageTreatmentValue: "2500",
    availableCommercialCapacity: "5 additional treatment starts per month.",
    currentAcquisitionCost: "100",
    commercialDataSource: "Discovery notes, current spend and conservative private dental treatment assumptions.",
    commercialChangeReason: "Approved test fixture for proposal readiness coverage.",
    commercialApprovalStatus: "approved",
    discoverySource: "Recorded discovery call and CRM notes from 10 Aug 2026.",
    customerWording: "We need to understand which implant enquiries are being missed and where follow-up is failing.",
    evidenceConfidenceState: "confirmed_on_call",
    activeConstraintId: "Missed calls and unclear booking movement for high-value dental enquiries.",
    activeConstraintConfidenceState: "confirmed_on_call",
    economicUnit: "accepted implant case",
    clinicConfirmedContribution: "2500",
    contributionEvidenceSourceDate: "Confirmed from discovery notes on 10 Aug 2026.",
    contributionConfirmationState: "confirmed_on_call",
    selectedMediaSpend: "3000",
    paybackState: "confirmed_on_call",
    liveDataStatus: "partially_connected",
    knownDataLimitations: "Live usefulness depends on call, form, CRM and booking data being connected.",
    sectorImageApprovalStatus: "approved",
    sectorImageProvenance: "ClinicGrower V5 approved dental imagery asset pack.",
    sectorImages: [
      {
        slot: "cover",
        imageId: "dental-cover",
        url: "/brand/proposal/v5-reference/dental_practices/p01-img02-1672x941.png",
        cropPosition: "center center",
        licence: "ClinicGrower V5 reference asset pack",
        provenance: "ClinicGrower final V5 proposal PDFs",
        approvalStatus: "approved",
      },
      {
        slot: "journey",
        imageId: "dental-journey",
        url: "/brand/proposal/v5-reference/dental_practices/p06-img01-1009x1559.png",
        cropPosition: "center center",
        licence: "ClinicGrower V5 reference asset pack",
        provenance: "ClinicGrower final V5 proposal PDFs",
        approvalStatus: "approved",
      },
      {
        slot: "proof",
        imageId: "dental-proof",
        url: "/brand/proposal/v5-reference/dental_practices/p10-img01-1122x1402.png",
        cropPosition: "center center",
        licence: "ClinicGrower V5 reference asset pack",
        provenance: "ClinicGrower final V5 proposal PDFs",
        approvalStatus: "approved",
      },
      {
        slot: "close",
        imageId: "dental-planning",
        url: "/brand/proposal/v5-reference/dental_practices/p13-img01-1672x941.png",
        cropPosition: "center center",
        licence: "ClinicGrower V5 reference asset pack",
        provenance: "ClinicGrower final V5 proposal PDFs",
        approvalStatus: "approved",
      },
    ],
    recommendedPlan: "Use ClinicGrower OS to connect dental enquiry visibility, booking movement, treatment opportunity and next actions.",
    proofAssetIds,
    scopeItems: [
      {
        category: "Strategy",
        title: "Dental growth priority plan",
        clientDescription: "A focused strategy for the agreed private dental treatments and local catchment.",
        frequency: "Monthly",
        quantityLimit: "One monthly review and priority plan update",
        treatmentsAndLocations: "Dental implants, Invisalign and private dentistry at the agreed location",
        dependencies: "Clinic provides treatment priorities, access and commercial assumptions before launch",
        clientResponsibilities: "Attend reviews, approve priorities and share booking outcomes",
        exclusions: "Additional locations, unrelated treatment lines and offline sales training",
        thirdPartyCosts: "Media spend and third-party tools are separate from ClinicGrower fees",
        inclusionStatus: "included",
        deliveryType: "recurring",
        isOptionalAddOn: false,
        isCustom: false,
        approvalStatus: "not_required",
        sortOrder: 10,
      },
    ],
    successMetrics: [
      "Dental enquiries|Increase qualified private treatment enquiries|Website forms, calls and CRM data where connected",
      "Booked consultations|Improve booking movement from enquiry|Booking records and call outcomes where connected",
    ],
  };
}

function makeReadyProposalPayload(recommendedPackageId: string, proofAssetIds: string[], overrides: Record<string, unknown> = {}) {
  const sectionContent = {
    ...makeReadySectionContent(proofAssetIds),
    ...((overrides.sectionContent as Record<string, unknown> | undefined) || {}),
  };
  const { sectionContent: _sectionContent, ...rest } = overrides;
  return {
    recommendedPackageId,
    packageName: "Clinic Growth Engine",
    valueCents: 125000,
    monthlyFeeCents: 125000,
    setupFeeCents: 0,
    currency: "GBP",
    adSpendNote: "Advertising spend is paid separately by the client.",
    vatStatus: "vat_exclusive",
    minimumTermMonths: 3,
    noticePeriodDays: 30,
    startDate: "2026-08-15",
    expiresAt: "2026-09-15T12:00:00.000Z",
    paymentTerms: "Monthly fees are billed in advance.",
    sectionContent,
    ...rest,
  };
}

async function createUser(clinicId: string, roleName: string, permissions: string[]): Promise<TestUser> {
  const id = uuidv4();
  const roleId = uuidv4();
  const email = `${id}@proposal.test`;
  await pool.execute(
    "INSERT INTO role (id, clinic_id, name, display_name, is_system) VALUES (?, ?, ?, ?, 0)",
    [roleId, clinicId, roleName, roleName],
  );
  if (permissions.length) {
    await pool.execute(
      `INSERT INTO role_permission (role_id, permission_id)
       SELECT ?, id FROM permission WHERE key_name IN (${permissions.map(() => "?").join(", ")})`,
      [roleId, ...permissions],
    );
  }
  await pool.execute(
    `INSERT INTO user
       (id, clinic_id, email, password_hash, first_name, last_name, role, email_verified_at, status, is_active)
     VALUES (?, ?, ?, ?, 'Proposal', 'Tester', ?, CURRENT_TIMESTAMP, 'active', 1)`,
    [id, clinicId, email, await hashPassword("password123"), roleName],
  );
  await pool.execute(
    "INSERT INTO clinic_membership (user_id, clinic_id, role, status, is_primary) VALUES (?, ?, ?, 'active', 1)",
    [id, clinicId, roleName],
  );
  return { id, roleId, token: generateToken({ userId: id, clinicId, role: roleName, email }) };
}

async function request(baseUrl: string, path: string, token: string, init: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  return { response, body: await response.json() as any };
}

async function requestPublic(baseUrl: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  return { response, body: await response.json() as any };
}

function discoveryAnswer(
  value: string,
  state: "known" | "working_diagnosis" | "provisional" | "to_confirm" = "known",
  overrides: Record<string, unknown> = {},
) {
  return {
    value,
    state,
    sourceLabel: "Live discovery call",
    sourceAt: "2026-08-17T10:30:00.000Z",
    customerWording: null,
    ...overrides,
  };
}

async function closeServer(server: Server) {
  server.closeIdleConnections?.();
  server.closeAllConnections?.();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

test("proposal API enforces permissions, persists statuses, and isolates tenants", async () => {
  await testConnection();
  await pool.execute(
    `INSERT IGNORE INTO permission (id, key_name, description) VALUES
       ('perm-proposals-read', 'proposals:read', 'Read internal proposals'),
       ('perm-proposals-write', 'proposals:write', 'Create and update internal proposals'),
       ('perm-proposal-templates-write', 'proposal_templates:write', 'Create and update proposal template drafts'),
       ('perm-proposal-templates-approve', 'proposal_templates:approve', 'Approve, publish and roll back proposal template versions')`,
  );
  const [adminTemplatePermissionRows]: any = await pool.execute(
    `SELECT
       SUM(CASE WHEN p.key_name = 'proposal_templates:write' THEN 1 ELSE 0 END) as canWrite,
       SUM(CASE WHEN p.key_name = 'proposal_templates:approve' THEN 1 ELSE 0 END) as canApprove
     FROM role r
     JOIN role_permission rp ON rp.role_id = r.id
     JOIN permission p ON p.id = rp.permission_id
     WHERE r.name = 'ADMIN'
       AND r.clinic_id IS NULL
       AND p.key_name IN ('proposal_templates:write', 'proposal_templates:approve')`,
  );
  assert.equal(Number(adminTemplatePermissionRows[0].canWrite), 1, "Admin role must have proposal template write permission");
  assert.equal(Number(adminTemplatePermissionRows[0].canApprove), 1, "Admin role must have proposal template approval permission");
  const [salesTemplateApprovalRows]: any = await pool.execute(
    `SELECT COUNT(*) as total
     FROM role r
     JOIN role_permission rp ON rp.role_id = r.id
     JOIN permission p ON p.id = rp.permission_id
     WHERE r.name = 'SALES'
       AND r.clinic_id IS NULL
       AND p.key_name = 'proposal_templates:approve'`,
  );
  assert.equal(Number(salesTemplateApprovalRows[0].total), 0, "Sales/proposal-editor role must not have template approval permission");
  const primaryClinicId = uuidv4();
  const otherClinicId = uuidv4();
  const contactId = uuidv4();
  const namelessContactId = uuidv4();
  const pipelineId = uuidv4();
  const openStageId = uuidv4();
  const customProposalStageId = uuidv4();
  const unsafePostTerminalOpenStageId = uuidv4();
  const proposalSentStageId = uuidv4();
  const wonStageId = uuidv4();
  const lostStageId = uuidv4();
  const dealId = uuidv4();
  const rollbackContactId = uuidv4();
  const rollbackDealId = uuidv4();
  const localAccountProfileId = uuidv4();
  const recommendedPackageId = uuidv4();
  const proposalTemplateId = uuidv4();
  const proposalTemplateVersionId = uuidv4();
  const proofAssetIds = [uuidv4(), uuidv4(), uuidv4(), uuidv4()];
  const users: TestUser[] = [];
  let convertedClientClinicId: string | null = null;

  await pool.execute(
    `INSERT INTO clinic (id, name, email, timezone, subscription_plan, subscription_status, max_users)
     VALUES (?, 'Proposal Test', ?, 'Europe/London', 'professional', 'active', 10),
            (?, 'Other Proposal Test', ?, 'Europe/London', 'professional', 'active', 10)`,
    [primaryClinicId, `${primaryClinicId}@test.local`, otherClinicId, `${otherClinicId}@test.local`],
  );

  const writer = await createUser(primaryClinicId, `PROPOSAL_WRITER_${Date.now()}`, ["proposals:read", "proposals:write"]);
  const templateApprover = await createUser(primaryClinicId, `PROPOSAL_TEMPLATE_APPROVER_${Date.now()}`, ["proposals:read", "proposal_templates:approve"]);
  const contactsOnly = await createUser(primaryClinicId, `CONTACT_WRITER_${Date.now()}`, ["contacts:read", "contacts:write"]);
  const otherWriter = await createUser(otherClinicId, `OTHER_PROPOSAL_WRITER_${Date.now()}`, ["proposals:read", "proposals:write"]);
  users.push(writer, templateApprover, contactsOnly, otherWriter);

  const proposalTemplateContent = {
    name: "ClinicGrower V19 Proposal",
    description: "Published V19 proposal template for tests.",
    packageName: "Clinic Growth Engine",
    defaultSections: {
      personalIntroduction: "Template introduction for existing V19 proposal builder tests.",
      diagnosis: "Template diagnosis for existing V19 proposal builder tests.",
      recommendedPlan: "Template recommendation for existing V19 proposal builder tests.",
      nextSteps: "Template next step for existing V19 proposal builder tests.",
      investmentNotes: "Template investment note for existing V19 proposal builder tests.",
    },
    defaultRoadmap: ["Baseline", "Implement", "Review"],
    defaultTerms: "Package terms remain sourced from the approved catalogue.",
    defaultSuccessMetrics: ["Qualified enquiries", "Booked consultations"],
    editablePolicyVersion: "proposal-template-fields-2026-08-21",
    lockedFields: ["packageName", "defaultTerms", "defaultScopeItems", "packageCatalogue", "proofAssets", "crmClientData"],
  };
  await pool.execute(
    `INSERT INTO proposal_template
      (id, clinic_id, template_key, name, description, package_name, default_sections,
       default_roadmap, default_terms, default_success_metrics, sort_order, is_active)
     VALUES (?, ?, 'clinicgrower_v5', ?, ?, ?, ?, ?, ?, ?, 10, 1)`,
    [
      proposalTemplateId,
      primaryClinicId,
      proposalTemplateContent.name,
      proposalTemplateContent.description,
      proposalTemplateContent.packageName,
      JSON.stringify(proposalTemplateContent.defaultSections),
      JSON.stringify(proposalTemplateContent.defaultRoadmap),
      proposalTemplateContent.defaultTerms,
      JSON.stringify(proposalTemplateContent.defaultSuccessMetrics),
    ],
  );
  await pool.execute(
    `INSERT INTO proposal_template_version
      (id, clinic_id, template_id, template_key, version_number, content, content_hash, status,
       created_by, submitted_by, approved_by, published_by, submitted_at, approved_at, published_at, change_summary)
     VALUES (?, ?, ?, 'clinicgrower_v5', 1, ?, ?, 'published',
       ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'Initial published test template version.')`,
    [
      proposalTemplateVersionId,
      primaryClinicId,
      proposalTemplateId,
      JSON.stringify(proposalTemplateContent),
      "a".repeat(64),
      writer.id,
      writer.id,
      templateApprover.id,
      templateApprover.id,
    ],
  );

  await pool.execute(
    `INSERT INTO growth_package
      (id, clinic_id, name, price_cents, currency, billing_frequency, setup_fee_cents,
       included_features, internal_notes, proposal_wording, sort_order, status, is_default,
       catalogue_version, commercial_notes)
     VALUES (?, ?, 'Clinic Growth Engine', 125000, 'GBP', 'monthly', 0,
       JSON_ARRAY('Dental enquiry visibility', 'Booking accountability'), NULL,
       'Approved ClinicGrower OS package wording for dental proposal tests.', 10, 'active', 1,
       'v5-test-catalogue',
       JSON_OBJECT('v5ScopeItems', JSON_ARRAY(JSON_OBJECT(
         'category', 'Strategy',
         'title', 'Package-owned dental growth operating system',
         'description', 'Approved package scope used to prove V5 snapshots freeze catalogue scope rather than renderer fallback data.',
         'frequency', 'Monthly',
         'quantityLimit', 'One operating rhythm and priority review',
         'treatmentsAndLocations', 'Dental implants, Invisalign and private dentistry at the agreed location',
         'dependency', 'Clinic provides approved access, owner feedback and booking outcome data',
         'owner', 'ClinicGrower and named clinic owner',
         'exclusion', 'Unapproved locations, unrelated treatments and third-party media spend',
         'thirdPartyCosts', 'Media spend and third-party tools remain separate',
         'inclusionStatus', 'included',
         'deliveryType', 'recurring',
         'isOptionalAddOn', false,
         'approvalStatus', 'not_required',
         'sortOrder', 10
       ))))`,
    [recommendedPackageId, primaryClinicId],
  );
  const proofAssetValues: any[] = [
    proofAssetIds[0],
    primaryClinicId,
    writer.id,
    writer.id,
    proofAssetIds[1],
    primaryClinicId,
    writer.id,
    writer.id,
    proofAssetIds[2],
    primaryClinicId,
    writer.id,
    writer.id,
    proofAssetIds[3],
    primaryClinicId,
    writer.id,
    writer.id,
  ];
  await pool.execute(
    `INSERT INTO proposal_proof_asset
      (id, clinic_id, type, title, copy, media_url, sector_tags, sort_order, is_active, created_by, updated_by)
     VALUES
      (?, ?, 'case_study', 'Dental case study with delivery context',
       'Approved dental case study showing enquiry visibility and booking-accountability work for a private dental clinic.',
       'https://clinicgrower.co.uk/case-studies/dental', JSON_ARRAY('dental', 'case study'), 10, 1, ?, ?),
      (?, ?, 'testimonial', 'Named dental testimonial with permission',
       'Permission approved testimonial from a dental clinic owner about clearer enquiry follow-up and accountability.',
       'https://clinicgrower.co.uk/testimonials/dental', JSON_ARRAY('dental', 'testimonial', 'permission approved'), 20, 1, ?, ?),
      (?, ?, 'product_screenshot', 'ClinicGrower OS dental performance view',
       'Real ClinicGrower OS screenshot showing dental enquiry, booking and next-action visibility where connected.',
       'https://clinicgrower.co.uk/images/clinicgrower-os-dental.png', JSON_ARRAY('clinicgrower os', 'dental', 'product screenshot'), 30, 1, ?, ?),
      (?, ?, 'performance_result', 'Dental visibility result over 90 days',
       'Over 90 days, this dental clinic gained clearer source-to-booking visibility after paid-search and follow-up changes. Delivery context recorded; not a guarantee.',
       'https://clinicgrower.co.uk/results/dental', JSON_ARRAY('dental', 'performance result', '90 days', 'delivery context'), 40, 1, ?, ?)`,
    proofAssetValues,
  );

  await pool.execute(
    `INSERT INTO contact
      (id, clinic_id, first_name, last_name, email, account_name, status, lead_status, source)
     VALUES
      (?, ?, 'Week', 'Two', ?, 'Week Two Dental Clinic', 'lead', 'qualified', 'referral'),
      (?, ?, 'Nameless', 'Clinic', ?, NULL, 'lead', 'qualified', 'referral'),
      (?, ?, 'Atomic', 'Rollback', ?, 'Atomic Rollback Clinic', 'lead', 'qualified', 'referral')`,
    [
      contactId,
      primaryClinicId,
      `${contactId}@test.local`,
      namelessContactId,
      primaryClinicId,
      `${namelessContactId}@test.local`,
      rollbackContactId,
      primaryClinicId,
      `${rollbackContactId}@test.local`,
    ],
  );
  for (const unsafeDriveUrl of [
    "javascript://drive.google.com/file/d/unsafe-item/view",
    "data://drive.google.com/file/d/unsafe-item/view",
    "https://drive.google.com.evil.example/file/d/unsafe-item/view",
  ]) {
    await assert.rejects(
      contactsService.updateDocumentLink(
        primaryClinicId,
        contactsOnly.id,
        contactId,
        "audit",
        { driveUrl: unsafeDriveUrl },
        {},
      ),
      /valid folder, file, or ZIP ID/i,
    );
  }
  const safeContactDocuments = await contactsService.updateDocumentLink(
    primaryClinicId,
    contactsOnly.id,
    contactId,
    "audit",
    { driveUrl: "https://docs.google.com/document/d/safe-contact-doc/edit" },
    {},
  );
  assert.equal(
    safeContactDocuments.find((document) => document.documentType === "audit")?.driveUrl,
    "https://docs.google.com/document/d/safe-contact-doc/edit",
  );
  await pool.execute(
    "INSERT INTO pipeline (id, clinic_id, name, description, stages) VALUES (?, ?, ?, ?, JSON_ARRAY('Open', 'Client Secured'))",
    [pipelineId, primaryClinicId, `Proposal outcome pipeline ${Date.now()}`, "Proposal outcome conversion test"],
  );
  await pool.execute(
    `INSERT INTO pipeline_stage
     (id, clinic_id, pipeline_id, name, color, position, kind, is_locked, created_by)
     VALUES
      (?, ?, ?, 'Open', 'bg-slate-500', 1, 'open', 0, ?),
      (?, ?, ?, 'Final Gate', 'bg-violet-500', 2, 'open', 0, ?),
      (?, ?, ?, 'Client Secured', 'bg-emerald-500', 3, 'won', 1, ?),
      (?, ?, ?, 'Closed Without Sale', 'bg-red-500', 4, 'lost', 1, ?),
      (?, ?, ?, 'Post-Closure Holding', 'bg-slate-700', 5, 'open', 0, ?)`,
    [
      openStageId,
      primaryClinicId,
      pipelineId,
      writer.id,
      customProposalStageId,
      primaryClinicId,
      pipelineId,
      writer.id,
      wonStageId,
      primaryClinicId,
      pipelineId,
      writer.id,
      lostStageId,
      primaryClinicId,
      pipelineId,
      writer.id,
      unsafePostTerminalOpenStageId,
      primaryClinicId,
      pipelineId,
      writer.id,
    ],
  );
  await pool.execute(
    `INSERT INTO deal
      (id, clinic_id, contact_id, pipeline_id, pipeline_stage_id, title, value, stage,
       probability, owner_id, source, treatment, status, stage_changed_at, created_by)
     VALUES (?, ?, ?, ?, ?, 'Proposal-linked Growth Engine opportunity', 1250.00, 'Open',
       50, ?, 'referral', 'Growth Engine', 'open', CURRENT_TIMESTAMP, ?)`,
    [dealId, primaryClinicId, contactId, pipelineId, openStageId, writer.id, writer.id],
  );
  await pool.execute(
    `INSERT INTO deal
      (id, clinic_id, contact_id, pipeline_id, pipeline_stage_id, title, value, stage,
       probability, owner_id, source, treatment, status, stage_changed_at, created_by)
     VALUES (?, ?, ?, ?, ?, 'Atomic rollback opportunity', 900.00, 'Open',
       50, ?, 'referral', 'Growth Engine', 'open', CURRENT_TIMESTAMP, ?)`,
    [
      rollbackDealId,
      primaryClinicId,
      rollbackContactId,
      pipelineId,
      openStageId,
      writer.id,
      writer.id,
    ],
  );

  const expressModule = await import("express") as any;
  const app = expressModule.default();
  app.use(expressModule.default.json());
  app.use("/api/proposals", proposalsRoutes);
  app.use(errorHandler);
  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not start proposal test server");
  const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;

  try {
    const forbidden = await request(baseUrl, "/api/proposals", contactsOnly.token);
    assert.equal(forbidden.response.status, 403, "contact permissions must not grant proposal access");

    const crossWorkspaceOwner = await request(baseUrl, "/api/proposals", writer.token, {
      method: "POST",
      body: JSON.stringify({
        contactId,
        proposalName: "Invalid cross-workspace owner",
        ownerId: otherWriter.id,
      }),
    });
    assert.equal(crossWorkspaceOwner.response.status, 400);
    assert.match(crossWorkspaceOwner.body.message, /active member of this workspace/i);

    const missingClinicName = await request(baseUrl, "/api/proposals", writer.token, {
      method: "POST",
      body: JSON.stringify(makeReadyProposalPayload(recommendedPackageId, proofAssetIds, {
        contactId: namelessContactId,
        proposalName: "Missing clinic name proposal",
        status: "ready",
      })),
    });
    assert.equal(missingClinicName.response.status, 400);
    const missingClinicNameText = JSON.stringify(missingClinicName.body);
    assert.ok(
      /complete the clinic\/account name/i.test(missingClinicNameText),
      "ready V5 proposals must require a clinic/account name before freezing or rendering",
    );

    const templateList = await request(baseUrl, "/api/proposals/templates?includeInactive=true", writer.token);
    assert.equal(templateList.response.status, 200);
    const v5Template = templateList.body.data.find((template: any) => template.templateKey === "clinicgrower_v5");
    assert.ok(v5Template, "clinicgrower_v5 template should be available for proposal creation");
    assert.equal(v5Template.activeVersion.status, "published");
    assert.equal(v5Template.activeVersion.versionNumber, 1);

    const proofLibraryForbidden = await request(baseUrl, "/api/proposals/proof-assets", contactsOnly.token);
    assert.equal(proofLibraryForbidden.response.status, 403, "proof library reads require proposal access");

    const createdProofAsset = await request(baseUrl, "/api/proposals/proof-assets", writer.token, {
      method: "POST",
      body: JSON.stringify({
        type: "testimonial",
        title: "Permissioned owner testimonial for proof library",
        copy: "Permission approved testimonial used to prove searchable proposal proof library management.",
        mediaUrl: "/brand/proof/tanja-phillips.webp",
        sectorTags: ["testimonial", "permission approved", "dental"],
        sortOrder: 55,
      }),
    });
    assert.equal(createdProofAsset.response.status, 201);
    assert.equal(createdProofAsset.body.data.status, "active");
    assert.equal(createdProofAsset.body.data.version, 1);

    const searchedProofLibrary = await request(
      baseUrl,
      "/api/proposals/proof-assets?search=permissioned&type=testimonial&tag=dental&limit=5",
      writer.token,
    );
    assert.equal(searchedProofLibrary.response.status, 200);
    assert.equal(searchedProofLibrary.body.data.pagination.limit, 5);
    assert.ok(searchedProofLibrary.body.data.items.some((item: any) => item.id === createdProofAsset.body.data.id));

    const crossTenantProofLibrary = await request(baseUrl, "/api/proposals/proof-assets?status=all", otherWriter.token);
    assert.equal(crossTenantProofLibrary.response.status, 200);
    assert.equal(
      crossTenantProofLibrary.body.data.items.some((item: any) => item.id === createdProofAsset.body.data.id),
      false,
      "proof library rows must stay scoped to the user's clinic",
    );

    const updatedProofAsset = await request(
      baseUrl,
      `/api/proposals/proof-assets/${createdProofAsset.body.data.id}`,
      writer.token,
      {
        method: "PATCH",
        body: JSON.stringify({
          title: "Permissioned owner testimonial for proof library updated",
          sectorTags: ["testimonial", "permission approved", "dental", "library search"],
        }),
      },
    );
    assert.equal(updatedProofAsset.response.status, 200);
    assert.equal(updatedProofAsset.body.data.version, 2);
    assert.equal(updatedProofAsset.body.data.title, "Permissioned owner testimonial for proof library updated");

    const archivedProofAsset = await request(
      baseUrl,
      `/api/proposals/proof-assets/${createdProofAsset.body.data.id}/archive`,
      writer.token,
      { method: "POST" },
    );
    assert.equal(archivedProofAsset.response.status, 200);
    assert.equal(archivedProofAsset.body.data.status, "archived");

    const activeProofLibraryAfterArchive = await request(baseUrl, "/api/proposals/proof-assets", writer.token);
    assert.equal(
      activeProofLibraryAfterArchive.body.data.items.some((item: any) => item.id === createdProofAsset.body.data.id),
      false,
      "archived proof assets should not appear in the default active list",
    );

    const restoredProofAsset = await request(
      baseUrl,
      `/api/proposals/proof-assets/${createdProofAsset.body.data.id}/restore`,
      writer.token,
      { method: "POST" },
    );
    assert.equal(restoredProofAsset.response.status, 200);
    assert.equal(restoredProofAsset.body.data.status, "active");

    const scopeLibraryForbidden = await request(baseUrl, "/api/proposals/scope-library", contactsOnly.token);
    assert.equal(scopeLibraryForbidden.response.status, 403, "scope library reads require proposal access");

    const createdScopeLibraryItem = await request(baseUrl, "/api/proposals/scope-library", writer.token, {
      method: "POST",
      body: JSON.stringify({
        templateKey: "clinicgrower_v5",
        name: "Consultation conversion review",
        category: "Conversion",
        clientDescription: "Review the booking route, enquiry response and consultation handover points before scale-up.",
        deliverables: ["Booking route review", "Response ownership notes"],
        frequency: "One-off",
        quantityLimit: "One review",
        inclusionStatus: "included",
        deliveryType: "one_off",
        sortOrder: 15,
      }),
    });
    assert.equal(createdScopeLibraryItem.response.status, 201);
    assert.equal(createdScopeLibraryItem.body.data.templateKey, "clinicgrower_v5");
    assert.equal(createdScopeLibraryItem.body.data.status, "active");
    assert.equal(createdScopeLibraryItem.body.data.version, 1);
    assert.deepEqual(createdScopeLibraryItem.body.data.deliverables, ["Booking route review", "Response ownership notes"]);

    const duplicateScopeLibraryItem = await request(baseUrl, "/api/proposals/scope-library", writer.token, {
      method: "POST",
      body: JSON.stringify({
        templateKey: "clinicgrower_v5",
        name: "Consultation conversion review",
        category: "Conversion",
        clientDescription: "Duplicate active rows should not be created.",
      }),
    });
    assert.equal(duplicateScopeLibraryItem.response.status, 409);

    const searchedScopeLibrary = await request(
      baseUrl,
      "/api/proposals/scope-library?search=booking&category=Conversion&limit=5",
      writer.token,
    );
    assert.equal(searchedScopeLibrary.response.status, 200);
    assert.equal(searchedScopeLibrary.body.data.pagination.limit, 5);
    assert.ok(searchedScopeLibrary.body.data.items.some((item: any) => item.id === createdScopeLibraryItem.body.data.id));

    const crossTenantScopeLibrary = await request(baseUrl, "/api/proposals/scope-library?status=all", otherWriter.token);
    assert.equal(crossTenantScopeLibrary.response.status, 200);
    assert.equal(
      crossTenantScopeLibrary.body.data.items.some((item: any) => item.id === createdScopeLibraryItem.body.data.id),
      false,
      "scope library rows must stay scoped to the user's clinic",
    );

    const updatedScopeLibraryItem = await request(
      baseUrl,
      `/api/proposals/scope-library/${createdScopeLibraryItem.body.data.id}`,
      writer.token,
      {
        method: "PATCH",
        body: JSON.stringify({
          name: "Consultation conversion review updated",
          deliverables: ["Booking route review", "Response ownership notes", "Consultation follow-up check"],
        }),
      },
    );
    assert.equal(updatedScopeLibraryItem.response.status, 200);
    assert.equal(updatedScopeLibraryItem.body.data.version, 2);
    assert.equal(updatedScopeLibraryItem.body.data.name, "Consultation conversion review updated");

    const archivedScopeLibraryItem = await request(
      baseUrl,
      `/api/proposals/scope-library/${createdScopeLibraryItem.body.data.id}/archive`,
      writer.token,
      { method: "POST" },
    );
    assert.equal(archivedScopeLibraryItem.response.status, 200);
    assert.equal(archivedScopeLibraryItem.body.data.status, "archived");

    const activeScopeLibraryAfterArchive = await request(baseUrl, "/api/proposals/scope-library", writer.token);
    assert.equal(
      activeScopeLibraryAfterArchive.body.data.items.some((item: any) => item.id === createdScopeLibraryItem.body.data.id),
      false,
      "archived scope library rows should not appear in the default active list",
    );

    const restoredScopeLibraryItem = await request(
      baseUrl,
      `/api/proposals/scope-library/${createdScopeLibraryItem.body.data.id}/restore`,
      writer.token,
      { method: "POST" },
    );
    assert.equal(restoredScopeLibraryItem.response.status, 200);
    assert.equal(restoredScopeLibraryItem.body.data.status, "active");

    const draftTemplateVersion = await request(
      baseUrl,
      `/api/proposals/templates/${v5Template.id}/versions`,
      writer.token,
      {
        method: "POST",
        body: JSON.stringify({ changeSummary: "Create a template governance draft." }),
      },
    );
    assert.equal(draftTemplateVersion.response.status, 201);
    assert.equal(draftTemplateVersion.body.data.status, "draft");
    assert.equal(draftTemplateVersion.body.data.sourceVersionId, proposalTemplateVersionId);

    const editedTemplateVersion = await request(
      baseUrl,
      `/api/proposals/templates/${v5Template.id}/versions/${draftTemplateVersion.body.data.id}`,
      writer.token,
      {
        method: "PATCH",
        body: JSON.stringify({
          expectedContentHash: draftTemplateVersion.body.data.contentHash,
          changeSummary: "Update editable diagnosis copy.",
          content: {
            defaultSections: {
              diagnosis: "Approved governance edit to the reusable diagnosis section.",
            },
          },
        }),
      },
    );
    assert.equal(editedTemplateVersion.response.status, 200);
    assert.notEqual(editedTemplateVersion.body.data.contentHash, draftTemplateVersion.body.data.contentHash);
    assert.equal(
      editedTemplateVersion.body.data.content.defaultSections.diagnosis,
      "Approved governance edit to the reusable diagnosis section.",
    );
    assert.equal(editedTemplateVersion.body.data.content.packageName, "Clinic Growth Engine");

    const submittedTemplateVersion = await request(
      baseUrl,
      `/api/proposals/templates/${v5Template.id}/versions/${editedTemplateVersion.body.data.id}/submit`,
      writer.token,
      { method: "POST" },
    );
    assert.equal(submittedTemplateVersion.response.status, 200);
    assert.equal(submittedTemplateVersion.body.data.status, "in_review");

    const unauthorizedTemplateApproval = await request(
      baseUrl,
      `/api/proposals/templates/${v5Template.id}/versions/${editedTemplateVersion.body.data.id}/approve`,
      writer.token,
      { method: "POST" },
    );
    assert.equal(unauthorizedTemplateApproval.response.status, 403);

    const approvedTemplateVersion = await request(
      baseUrl,
      `/api/proposals/templates/${v5Template.id}/versions/${editedTemplateVersion.body.data.id}/approve`,
      templateApprover.token,
      { method: "POST" },
    );
    assert.equal(approvedTemplateVersion.response.status, 200);
    assert.equal(approvedTemplateVersion.body.data.status, "approved");

    const rejectedImmutableEdit = await request(
      baseUrl,
      `/api/proposals/templates/${v5Template.id}/versions/${editedTemplateVersion.body.data.id}`,
      writer.token,
      {
        method: "PATCH",
        body: JSON.stringify({
          expectedContentHash: approvedTemplateVersion.body.data.contentHash,
          content: { defaultSections: { diagnosis: "This should not be saved." } },
        }),
      },
    );
    assert.equal(rejectedImmutableEdit.response.status, 409);

    const publishedTemplateVersion = await request(
      baseUrl,
      `/api/proposals/templates/${v5Template.id}/versions/${editedTemplateVersion.body.data.id}/publish`,
      templateApprover.token,
      { method: "POST" },
    );
    assert.equal(publishedTemplateVersion.response.status, 200);
    assert.equal(publishedTemplateVersion.body.data.status, "published");

    const versionsAfterPublish = await request(baseUrl, `/api/proposals/templates/${v5Template.id}/versions`, writer.token);
    assert.equal(versionsAfterPublish.response.status, 200);
    assert.equal(versionsAfterPublish.body.data.filter((version: any) => version.status === "published").length, 1);
    assert.equal(
      versionsAfterPublish.body.data.find((version: any) => version.id === proposalTemplateVersionId)?.status,
      "superseded",
    );

    const rejectionDraft = await request(
      baseUrl,
      `/api/proposals/templates/${v5Template.id}/versions`,
      writer.token,
      {
        method: "POST",
        body: JSON.stringify({ changeSummary: "Draft intended for rejection." }),
      },
    );
    assert.equal(rejectionDraft.response.status, 201);
    const rejectionSubmitted = await request(
      baseUrl,
      `/api/proposals/templates/${v5Template.id}/versions/${rejectionDraft.body.data.id}/submit`,
      writer.token,
      { method: "POST" },
    );
    assert.equal(rejectionSubmitted.response.status, 200);
    const rejectedTemplateVersion = await request(
      baseUrl,
      `/api/proposals/templates/${v5Template.id}/versions/${rejectionDraft.body.data.id}/reject`,
      templateApprover.token,
      {
        method: "POST",
        body: JSON.stringify({ reason: "Rejected during governance test." }),
      },
    );
    assert.equal(rejectedTemplateVersion.response.status, 200);
    assert.equal(rejectedTemplateVersion.body.data.status, "rejected");
    assert.equal(rejectedTemplateVersion.body.data.rejectionReason, "Rejected during governance test.");

    const rejectedTemplateProposal = await request(baseUrl, "/api/proposals", writer.token, {
      method: "POST",
      body: JSON.stringify({
        contactId,
        proposalName: "Rejected template version proposal",
        templateKey: "clinicgrower_v5",
        templateVersionId: rejectedTemplateVersion.body.data.id,
      }),
    });
    assert.equal(rejectedTemplateProposal.response.status, 409);

    const rollbackTemplateVersion = await request(
      baseUrl,
      `/api/proposals/templates/${v5Template.id}/rollback`,
      templateApprover.token,
      {
        method: "POST",
        body: JSON.stringify({
          sourceVersionId: proposalTemplateVersionId,
          reason: "Rollback to the original published wording.",
        }),
      },
    );
    assert.equal(rollbackTemplateVersion.response.status, 201);
    assert.equal(rollbackTemplateVersion.body.data.status, "published");
    assert.equal(rollbackTemplateVersion.body.data.sourceVersionId, proposalTemplateVersionId);

    const comparison = await request(
      baseUrl,
      `/api/proposals/templates/${v5Template.id}/versions/compare?fromVersionId=${publishedTemplateVersion.body.data.id}&toVersionId=${rollbackTemplateVersion.body.data.id}`,
      writer.token,
    );
    assert.equal(comparison.response.status, 200);
    assert.ok(comparison.body.data.diffs.some((diff: any) => diff.path === "defaultSections.diagnosis"));

    const staleTemplateProposal = await request(baseUrl, "/api/proposals", writer.token, {
      method: "POST",
      body: JSON.stringify(makeReadyProposalPayload(recommendedPackageId, proofAssetIds, {
        contactId,
        dealId,
        proposalName: "Stale template version proposal",
        status: "ready",
        templateKey: "clinicgrower_v5",
        templateVersionId: rollbackTemplateVersion.body.data.id,
      })),
    });
    assert.equal(staleTemplateProposal.response.status, 201);
    assert.equal(staleTemplateProposal.body.data.templateVersionId, rollbackTemplateVersion.body.data.id);
    assert.equal(staleTemplateProposal.body.data.templateContentHash, rollbackTemplateVersion.body.data.contentHash);

    const supersedingDraft = await request(
      baseUrl,
      `/api/proposals/templates/${v5Template.id}/versions`,
      writer.token,
      {
        method: "POST",
        body: JSON.stringify({
          changeSummary: "Supersede the version bound to a draft proposal.",
          content: {
            defaultSections: {
              diagnosis: "New published diagnosis after a stale proposal was drafted.",
            },
          },
        }),
      },
    );
    assert.equal(supersedingDraft.response.status, 201);
    await request(
      baseUrl,
      `/api/proposals/templates/${v5Template.id}/versions/${supersedingDraft.body.data.id}/submit`,
      writer.token,
      { method: "POST" },
    );
    await request(
      baseUrl,
      `/api/proposals/templates/${v5Template.id}/versions/${supersedingDraft.body.data.id}/approve`,
      templateApprover.token,
      { method: "POST" },
    );
    const supersedingPublished = await request(
      baseUrl,
      `/api/proposals/templates/${v5Template.id}/versions/${supersedingDraft.body.data.id}/publish`,
      templateApprover.token,
      { method: "POST" },
    );
    assert.equal(supersedingPublished.response.status, 200);
    assert.equal(supersedingPublished.body.data.status, "published");

    const staleTemplateSend = await request(
      baseUrl,
      `/api/proposals/${staleTemplateProposal.body.data.id}/send`,
      writer.token,
      {
        method: "POST",
        body: JSON.stringify({
          recipientEmail: "stale-template@example.com",
          recipientName: "Stale Template",
          sendMethod: "manual_email",
        }),
      },
    );
    assert.equal(staleTemplateSend.response.status, 409);
    assert.match(staleTemplateSend.body.message, /template version/i);

    const created = await request(baseUrl, "/api/proposals", writer.token, {
      method: "POST",
      body: JSON.stringify({
        contactId,
        dealId,
        proposalName: "Week 2 API proposal",
        status: "draft",
        valueCents: 125000,
        currency: "GBP",
      }),
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.body.data.status, "draft");
    assert.equal(created.body.data.valueCents, 125000);

    const draftValidation = await request(
      baseUrl,
      `/api/proposals/${created.body.data.id}/validate`,
      writer.token,
      { method: "POST" },
    );
    assert.equal(draftValidation.response.status, 200);
    assert.equal(draftValidation.body.data.ready, false);
    assert.equal(draftValidation.body.data.frozen, false);
    assert.ok(draftValidation.body.data.issues.some((issue: string) => /approved package/i.test(issue)));

    const prematureShare = await request(
      baseUrl,
      `/api/proposals/${created.body.data.id}/share`,
      writer.token,
      { method: "POST" },
    );
    assert.equal(prematureShare.response.status, 400);

    const ready = await request(baseUrl, `/api/proposals/${created.body.data.id}`, writer.token, {
      method: "PATCH",
      body: JSON.stringify(makeReadyProposalPayload(recommendedPackageId, proofAssetIds, { status: "ready" })),
    });
    assert.equal(ready.response.status, 200);
    assert.equal(ready.body.data.status, "ready");
    assert.ok(ready.body.data.readyAt);

    const readyValidation = await request(
      baseUrl,
      `/api/proposals/${created.body.data.id}/validate`,
      writer.token,
      { method: "POST" },
    );
    assert.equal(readyValidation.response.status, 200);
    assert.equal(readyValidation.body.data.ready, true);
    assert.equal(readyValidation.body.data.canRenderV5, true);
    assert.equal(readyValidation.body.data.pageCount, 15);
    const readyRender = await request(baseUrl, `/api/proposals/${created.body.data.id}/render`, writer.token);
    assert.equal(readyRender.response.status, 200);
    assert.equal(readyRender.body.data.frozen, false);
    assert.equal(readyRender.body.data.v5Snapshot.pageCount, 15);
    assert.equal(readyRender.body.data.v5Snapshot.scope[0].title, "Package-owned dental growth operating system");

    const approvalApiDraft = await request(baseUrl, "/api/proposals", writer.token, {
      method: "POST",
      body: JSON.stringify(makeReadyProposalPayload(recommendedPackageId, proofAssetIds, {
        contactId,
        proposalName: "Approval API proposal",
        status: "draft",
      })),
    });
    assert.equal(approvalApiDraft.response.status, 201);
    const approvalApiReady = await request(
      baseUrl,
      `/api/proposals/${approvalApiDraft.body.data.id}/approve`,
      writer.token,
      { method: "POST" },
    );
    assert.equal(approvalApiReady.response.status, 200);
    assert.equal(approvalApiReady.body.data.status, "ready");
    const versionLocked = await request(
      baseUrl,
      `/api/proposals/${approvalApiDraft.body.data.id}/version-lock`,
      writer.token,
      {
        method: "POST",
        body: JSON.stringify({
          recipientEmail: "version-lock@example.com",
          recipientName: "Version Lock",
        }),
      },
    );
    assert.equal(versionLocked.response.status, 200);
    assert.equal(versionLocked.body.data.status, "sent");
    assert.equal(versionLocked.body.data.sendMethod, "version_lock");
    assert.equal(versionLocked.body.data.v5Snapshot.pageCount, 15);

    const unauthorizedDiscoveryStart = await request(
      baseUrl,
      "/api/proposals/discovery-sessions/start",
      contactsOnly.token,
      {
        method: "POST",
        body: JSON.stringify({ contactId }),
      },
    );
    assert.equal(unauthorizedDiscoveryStart.response.status, 403);

    const discoveryStart = await request(
      baseUrl,
      "/api/proposals/discovery-sessions/start",
      writer.token,
      {
        method: "POST",
        body: JSON.stringify({ contactId, dealId }),
      },
    );
    assert.equal(discoveryStart.response.status, 200);
    const discoverySessionId = discoveryStart.body.data.id;

    const discoveryResume = await request(
      baseUrl,
      "/api/proposals/discovery-sessions/start",
      writer.token,
      {
        method: "POST",
        body: JSON.stringify({ contactId, dealId }),
      },
    );
    assert.equal(discoveryResume.response.status, 200);
    assert.equal(discoveryResume.body.data.id, discoverySessionId, "call mode should resume the active contact/deal session");

    const partialDiscovery = await request(
      baseUrl,
      `/api/proposals/discovery-sessions/${discoverySessionId}`,
      writer.token,
      {
        method: "PATCH",
        body: JSON.stringify({
          status: "paused",
          answers: {
            recommendedPackageId: discoveryAnswer(recommendedPackageId, "known", {
              sourceLabel: "Transcript-assisted call import",
              evidenceReference: "Transcript recommendation line 12",
            }),
            confirmedContribution: discoveryAnswer("1500", "provisional", {
              sourceLabel: "Transcript-assisted call import",
              evidenceReference: "Transcript contribution line 18",
              notes: "Owner wording needs confirmation before commercial case.",
            }),
          },
          freeNotes: "Transcript-assisted partial call import. Contribution evidence needs human review.",
        }),
      },
    );
    assert.equal(partialDiscovery.response.status, 200);
    assert.equal(partialDiscovery.body.data.status, "paused");
    assert.equal(partialDiscovery.body.data.answers.confirmedContribution.evidenceReference, "Transcript contribution line 18");
    assert.equal(partialDiscovery.body.data.answers.confirmedContribution.state, "provisional");
    assert.ok(
      partialDiscovery.body.data.conflicts.some((conflict: any) => conflict.code === "contribution_not_confirmed"),
      "provisional contribution must remain a visible blocker",
    );

    const fullDiscoveryAnswers = {
      peopleDecisionMaker: discoveryAnswer("Dr Alex Morgan"),
      peopleRole: discoveryAnswer("Clinic owner"),
      contactDetails: discoveryAnswer("alex@example.com / 07123456789"),
      clinicType: discoveryAnswer("dental_clinic", "known", { evidenceReference: "CRM and live call clinic-type confirmation" }),
      locations: discoveryAnswer("Bristol private dental clinic"),
      whyNowOwnerWording: discoveryAnswer("We need to know which implant enquiries are being lost.", "known", {
        customerWording: "We need to know which implant enquiries are being lost.",
      }),
      commercialObjective: discoveryAnswer("Increase predictable implant consultations"),
      urgency: discoveryAnswer("The clinic is about to increase media spend and wants leakage visible first."),
      desiredStart: discoveryAnswer("2026-09-01"),
      decisionProcess: discoveryAnswer("Owner approval after proposal review"),
      priorityServices: discoveryAnswer("Dental implants\nInvisalign\nComposite bonding"),
      capacity: discoveryAnswer("5 additional consultations per month"),
      targetLocations: discoveryAnswer("Bristol and surrounding private dental catchment"),
      firstJourney: discoveryAnswer("Implant enquiry to accepted treatment plan"),
      currentDemand: discoveryAnswer("Relevant private treatment demand is present but not fully attributed."),
      enquiryHandling: discoveryAnswer("Calls, forms and WhatsApp are handled by reception and coordinator."),
      responseTime: discoveryAnswer("Same day where possible; missed calls are not fully reported."),
      booking: discoveryAnswer("12 booked consultations from around 40 monthly enquiries."),
      attendance: discoveryAnswer("80"),
      acceptanceEnrolment: discoveryAnswer("45"),
      recordedValue: discoveryAnswer("Treatment-plan value is held outside the marketing report."),
      currentMediaSpend: discoveryAnswer("3000"),
      approximateVolumes: discoveryAnswer("40"),
      knownCplCpa: discoveryAnswer("100"),
      trustedData: discoveryAnswer("CRM, call notes and discovery transcript", "known", {
        evidenceReference: "Transcript evidence bundle 2026-08-17",
      }),
      website: discoveryAnswer("WordPress website with lead forms"),
      crmPmsDiary: discoveryAnswer("Dental PMS and CRM notes"),
      analytics: discoveryAnswer("GA4 and ad platform conversion events"),
      dataLimitations: discoveryAnswer("Call outcomes, booking source and treatment acceptance are not fully connected."),
      economicUnit: discoveryAnswer("accepted implant case", "known", {
        sourceLabel: "Transcript-assisted call import",
        evidenceReference: "Transcript economic-unit line 23",
      }),
      price: discoveryAnswer("2500"),
      confirmedContribution: discoveryAnswer("2500", "known", {
        sourceLabel: "Live call resume",
        evidenceReference: "Owner confirmed contribution on resumed call",
        approvedBy: writer.id,
        approvedAt: "2026-08-17T11:10:00.000Z",
        approvalStatus: "approved",
      }),
      monthlyCapacity: discoveryAnswer("5"),
      paybackExpectation: discoveryAnswer("Break-even should use whole accepted cases", "known"),
      confirmationSourceDate: discoveryAnswer("Owner confirmation on 17 Aug 2026"),
      workingConstraint: discoveryAnswer("Missed calls and unclear booking movement"),
      scopeBoundary: discoveryAnswer("First scope covers one dental location and the agreed private treatment route."),
      selectedMedia: discoveryAnswer("3000"),
      setup: discoveryAnswer("0"),
      term: discoveryAnswer("3 months minimum"),
      proposedStart: discoveryAnswer("2026-09-01"),
      proofMode: discoveryAnswer("same-sector and approved cross-sector proof"),
      claimCaveats: discoveryAnswer("Historical proof is contextual and not a guarantee."),
      authorisedApprover: discoveryAnswer("Dr Alex Morgan"),
      clinicalBoundary: discoveryAnswer("Clinical suitability and treatment decisions remain with the clinic."),
      excludedWork: discoveryAnswer("Clinical advice, offline sales training and unrelated locations are excluded."),
      callOutcome: discoveryAnswer("Draft proposal approved for internal review"),
      nextAction: discoveryAnswer("Prepare the V19 proposal for review"),
      nextActionOwner: discoveryAnswer("ClinicGrower"),
      nextActionDueDate: discoveryAnswer("2026-08-18"),
    };

    const completedDiscovery = await request(
      baseUrl,
      `/api/proposals/discovery-sessions/${discoverySessionId}`,
      writer.token,
      {
        method: "PATCH",
        body: JSON.stringify({
          status: "completed",
          clinicType: "dental_clinic",
          recommendedPackageId,
          activeConstraintId: "Missed calls and unclear booking movement",
          answers: fullDiscoveryAnswers,
          callOutcome: "Draft proposal approved for internal review",
          nextAction: "Prepare the V19 proposal for review",
          nextActionDueAt: "2026-08-18T09:00:00.000Z",
        }),
      },
    );
    assert.equal(completedDiscovery.response.status, 200);
    assert.equal(completedDiscovery.body.data.status, "completed");
    assert.equal(completedDiscovery.body.data.conflicts.length, 0);

    const generatedDraft = await request(
      baseUrl,
      `/api/proposals/discovery-sessions/${discoverySessionId}/generate-draft`,
      writer.token,
      { method: "POST" },
    );
    assert.equal(generatedDraft.response.status, 201);
    assert.equal(generatedDraft.body.data.session.status, "draft_created");
    const callModeProposal = generatedDraft.body.data.proposal;
    assert.equal(callModeProposal.status, "draft");
    assert.equal(callModeProposal.sectionContent.fieldEvidenceReferences.economicUnit, "Transcript economic-unit line 23");
    assert.equal(
      callModeProposal.sectionContent.fieldEvidenceReferences.clinicConfirmedContribution,
      "Owner confirmed contribution on resumed call",
    );
    assert.equal(callModeProposal.sectionContent.fieldApprovals.clinicConfirmedContribution.approvedBy, writer.id);
    assert.equal(callModeProposal.sectionContent.fieldApprovals.clinicConfirmedContribution.approvalStatus, "approved");

    const completedCallModeSection = {
      ...makeReadySectionContent(proofAssetIds),
      fieldEvidenceReferences: {
        ...callModeProposal.sectionContent.fieldEvidenceReferences,
        discoverySource: "Transcript evidence bundle 2026-08-17",
      },
      fieldApprovals: callModeProposal.sectionContent.fieldApprovals,
    };
    const completedCallModeDraft = await request(
      baseUrl,
      `/api/proposals/${callModeProposal.id}`,
      writer.token,
      {
        method: "PATCH",
        body: JSON.stringify(makeReadyProposalPayload(recommendedPackageId, proofAssetIds, {
          contactId,
          dealId,
          proposalName: "Live-call generated V19 proposal",
          status: "draft",
          sectionContent: completedCallModeSection,
        })),
      },
    );
    assert.equal(completedCallModeDraft.response.status, 200);
    assert.equal(completedCallModeDraft.body.data.status, "draft");

    const approvedCallModeDraft = await request(
      baseUrl,
      `/api/proposals/${callModeProposal.id}/approve`,
      writer.token,
      { method: "POST" },
    );
    assert.equal(approvedCallModeDraft.response.status, 200);
    assert.equal(approvedCallModeDraft.body.data.status, "ready");

    const lockedCallModeProposal = await request(
      baseUrl,
      `/api/proposals/${callModeProposal.id}/version-lock`,
      writer.token,
      {
        method: "POST",
        body: JSON.stringify({
          recipientEmail: "call-mode@example.com",
          recipientName: "Call Mode Owner",
        }),
      },
    );
    assert.equal(lockedCallModeProposal.response.status, 200);
    assert.equal(lockedCallModeProposal.body.data.status, "sent");
    assert.equal(lockedCallModeProposal.body.data.v5Snapshot.pageCount, 15);
    assert.equal(
      lockedCallModeProposal.body.data.v5Snapshot.economics.economicUnit.evidenceReference,
      "Transcript economic-unit line 23",
    );
    assert.equal(
      lockedCallModeProposal.body.data.v5Snapshot.economics.contribution.approvedBy,
      writer.id,
    );

    const lockedCallModeRender = await request(baseUrl, `/api/proposals/${callModeProposal.id}/render`, writer.token);
    assert.equal(lockedCallModeRender.response.status, 200);
    assert.equal(lockedCallModeRender.body.data.frozen, true);
    assert.equal(lockedCallModeRender.body.data.v5Snapshot.snapshotHash, lockedCallModeProposal.body.data.v5SnapshotHash);

    const readyShare = await request(baseUrl, `/api/proposals/${created.body.data.id}/share`, writer.token, {
      method: "POST",
    });
    assert.equal(readyShare.response.status, 400);
    assert.match(readyShare.body.message, /sent/i);

    const sentForPublicPreview = await request(
      baseUrl,
      `/api/proposals/${created.body.data.id}/send`,
      writer.token,
      {
        method: "POST",
        body: JSON.stringify({
          recipientEmail: "week2-public@example.com",
          recipientName: "Week 2 Public",
          sendMethod: "manual_email",
        }),
      },
    );
    assert.equal(sentForPublicPreview.response.status, 200);
    assert.equal(sentForPublicPreview.body.data.v5Snapshot.schemaVersion, "proposal_v5");
    const proposalUrl = new URL(sentForPublicPreview.body.data.proposalUrl);
    assert.equal(proposalUrl.pathname, "/proposals/shared/");
    const publicToken = proposalUrl.searchParams.get("token");
    assert.ok(publicToken);

    const publicPreview = await requestPublic(
      baseUrl,
      `/api/proposals/shared/${encodeURIComponent(publicToken)}`,
    );
    assert.equal(publicPreview.response.status, 200);
    assert.equal(publicPreview.response.headers.get("cache-control"), "no-store");
    assert.equal(publicPreview.body.data.proposal.proposalName, "Week 2 API proposal");
    assert.equal(publicPreview.body.data.proposal.templateKey, "clinicgrower_v5");
    assert.equal(publicPreview.body.data.proposal.v5Snapshot.schemaVersion, "proposal_v5");
    assert.equal(publicPreview.body.data.proposal.sectionContent, null);
    assert.equal(publicPreview.body.data.proposal.coreData, null);
    for (const sensitiveField of [
      "id",
      "contactId",
      "dealId",
      "clientAccountProfileId",
      "recommendedPackageId",
      "ownerId",
      "ownerName",
      "status",
      "followUpAt",
      "sentAt",
      "sentToEmail",
      "sentToName",
      "sendMethod",
      "sendNote",
      "sentBy",
      "sentByName",
      "viewedAt",
      "acceptedAt",
      "acceptedReason",
      "wonAt",
      "wonReason",
      "lostAt",
      "lostReason",
      "objectionType",
      "proposalUrl",
      "notes",
      "internalMarginNote",
      "contactEmail",
      "dealTitle",
      "createdBy",
      "updatedBy",
      "createdAt",
      "updatedAt",
      "acceptanceRecord",
    ]) {
      assert.equal(
        Object.hasOwn(publicPreview.body.data.proposal, sensitiveField),
        false,
        `${sensitiveField} must not be public`,
      );
    }

    const viewed = await request(baseUrl, `/api/proposals/${created.body.data.id}`, writer.token);
    assert.equal(viewed.response.status, 200);
    assert.equal(viewed.body.data.status, "viewed");
    assert.ok(viewed.body.data.viewedAt);

    const [firstViewActivityRows]: any = await pool.execute(
      `SELECT COUNT(*) as total
       FROM activity
       WHERE clinic_id = ?
         AND contact_id = ?
         AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.action')) = 'proposal_viewed'`,
      [primaryClinicId, contactId],
    );
    assert.equal(Number(firstViewActivityRows[0].total), 1);

    const repeatedPublicPreview = await requestPublic(
      baseUrl,
      `/api/proposals/shared/${encodeURIComponent(publicToken)}`,
    );
    assert.equal(repeatedPublicPreview.response.status, 200);
    const [repeatedViewActivityRows]: any = await pool.execute(
      `SELECT COUNT(*) as total
       FROM activity
       WHERE clinic_id = ?
         AND contact_id = ?
         AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.action')) = 'proposal_viewed'`,
      [primaryClinicId, contactId],
    );
    assert.equal(Number(repeatedViewActivityRows[0].total), 1);

    const publicAcceptedProposal = await request(baseUrl, "/api/proposals", writer.token, {
      method: "POST",
      body: JSON.stringify(makeReadyProposalPayload(recommendedPackageId, proofAssetIds, {
        contactId,
        proposalName: "Public acceptance proposal",
        status: "ready",
        valueCents: 99500,
        monthlyFeeCents: 99500,
        currency: "GBP",
        paymentTerms: "Public acceptance payment terms.",
      })),
    });
    assert.equal(publicAcceptedProposal.response.status, 201);
    const publicAcceptedSent = await request(
      baseUrl,
      `/api/proposals/${publicAcceptedProposal.body.data.id}/send`,
      writer.token,
      {
        method: "POST",
        body: JSON.stringify({
          recipientEmail: "public-signer@example.com",
          recipientName: "Public Signer",
          sendMethod: "manual_email",
        }),
      },
    );
    assert.equal(publicAcceptedSent.response.status, 200);
    assert.equal(publicAcceptedSent.body.data.v5Snapshot.schemaVersion, "proposal_v5");
    const publicAcceptedToken = new URL(publicAcceptedSent.body.data.proposalUrl).searchParams.get("token");
    assert.ok(publicAcceptedToken);
    const publicAcceptance = await requestPublic(
      baseUrl,
      `/api/proposals/shared/${encodeURIComponent(publicAcceptedToken)}/accept`,
      {
        method: "POST",
        body: JSON.stringify({
          fullName: "Public Signer",
          email: "public-signer@example.com",
          legalCompanyName: "Public Signer Ltd",
          billingEmail: "billing-public@example.com",
          preferredStartDate: "2026-08-10",
          agreementAccepted: true,
          signatureConfirmation: "Public Signer",
        }),
      },
    );
    assert.equal(publicAcceptance.response.status, 200);
    assert.equal(publicAcceptance.body.data.proposal.status, undefined);
    assert.equal(publicAcceptance.body.data.acceptance.acceptedByName, "Public Signer");
    assert.equal(publicAcceptance.body.data.acceptance.legalCompanyName, "Public Signer Ltd");
    assert.equal(publicAcceptance.body.data.acceptance.billingEmail, "billing-public@example.com");
    assert.equal(publicAcceptance.body.data.acceptance.preferredStartDate, "2026-08-10");

    const publicAcceptedInternal = await request(
      baseUrl,
      `/api/proposals/${publicAcceptedProposal.body.data.id}`,
      writer.token,
    );
    assert.equal(publicAcceptedInternal.response.status, 200);
    assert.equal(publicAcceptedInternal.body.data.status, "accepted");
    assert.equal(publicAcceptedInternal.body.data.acceptanceRecord.acceptedByName, "Public Signer");
    assert.equal(publicAcceptedInternal.body.data.acceptanceRecord.legalCompanyName, "Public Signer Ltd");
    assert.equal(publicAcceptedInternal.body.data.acceptanceRecord.agreementAccepted, true);
    assert.ok(publicAcceptedInternal.body.data.acceptanceRecord.evidenceSha256);
    assert.ok(publicAcceptedInternal.body.data.acceptanceRecord.lockedAt);
    assert.equal(publicAcceptedInternal.body.data.v5SnapshotHash, publicAcceptedSent.body.data.v5SnapshotHash);
    assert.equal(publicAcceptedInternal.body.data.acceptanceRecord.v5SnapshotHash, publicAcceptedSent.body.data.v5SnapshotHash);
    assert.deepEqual(publicAcceptedInternal.body.data.acceptanceRecord.v5Snapshot, publicAcceptedSent.body.data.v5Snapshot);
    const repeatedPublicAcceptance = await requestPublic(
      baseUrl,
      `/api/proposals/shared/${encodeURIComponent(publicAcceptedToken)}/accept`,
      {
        method: "POST",
        body: JSON.stringify({
          fullName: "Public Signer",
          email: "public-signer@example.com",
          legalCompanyName: "Public Signer Ltd",
          billingEmail: "billing-public@example.com",
          preferredStartDate: "2026-08-10",
          agreementAccepted: true,
          signatureConfirmation: "Public Signer",
        }),
      },
    );
    assert.equal(repeatedPublicAcceptance.response.status, 200);
    const [publicCommercialEventRows]: any = await pool.execute(
      `SELECT idempotency_key as idempotencyKey,
              status,
              target_consumers as targetConsumers,
              payload
       FROM proposal_commercial_event
       WHERE clinic_id = ?
         AND proposal_id = ?
         AND event_type = 'proposal_accepted'`,
      [primaryClinicId, publicAcceptedProposal.body.data.id],
    );
    assert.equal(Number(publicCommercialEventRows.length), 1);
    assert.match(publicCommercialEventRows[0].idempotencyKey, new RegExp(`^proposal_accepted:${publicAcceptedProposal.body.data.id}:`));
    assert.equal(publicCommercialEventRows[0].status, "pending");
    const publicCommercialPayload = typeof publicCommercialEventRows[0].payload === "string"
      ? JSON.parse(publicCommercialEventRows[0].payload)
      : publicCommercialEventRows[0].payload;
    const publicTargetConsumers = typeof publicCommercialEventRows[0].targetConsumers === "string"
      ? JSON.parse(publicCommercialEventRows[0].targetConsumers)
      : publicCommercialEventRows[0].targetConsumers;
    assert.deepEqual(publicTargetConsumers, ["cg_058", "quickbooks", "onboarding", "clickup_delivery"]);
    assert.equal(publicCommercialPayload.proposal.id, publicAcceptedProposal.body.data.id);
    assert.equal(publicCommercialPayload.acceptance.legalCompanyName, "Public Signer Ltd");
    assert.equal(publicCommercialPayload.commercial.packageId, recommendedPackageId);

    const invalidV5Proposal = await request(baseUrl, "/api/proposals", writer.token, {
      method: "POST",
      body: JSON.stringify({
        contactId,
        proposalName: "Invalid V5 freeze candidate",
        templateKey: "clinicgrower_v5",
        status: "draft",
        expiresAt: "2026-09-20T12:00:00.000Z",
      }),
    });
    assert.equal(invalidV5Proposal.response.status, 201);
    const invalidV5Send = await request(
      baseUrl,
      `/api/proposals/${invalidV5Proposal.body.data.id}/send`,
      writer.token,
      {
        method: "POST",
        body: JSON.stringify({
          recipientEmail: "invalid-v5@example.com",
          recipientName: "Invalid V5",
          sendMethod: "manual_email",
        }),
      },
    );
    assert.equal(invalidV5Send.response.status, 400);
    const invalidV5AfterFailure = await request(
      baseUrl,
      `/api/proposals/${invalidV5Proposal.body.data.id}`,
      writer.token,
    );
    assert.equal(invalidV5AfterFailure.response.status, 200);
    assert.equal(invalidV5AfterFailure.body.data.status, "draft");
    assert.equal(invalidV5AfterFailure.body.data.v5Snapshot, null);
    assert.equal(invalidV5AfterFailure.body.data.v5SnapshotHash, null);

    const unfrozenInternalAcceptanceProposal = await request(baseUrl, "/api/proposals", writer.token, {
      method: "POST",
      body: JSON.stringify(makeReadyProposalPayload(recommendedPackageId, proofAssetIds, {
        contactId,
        proposalName: "Unfrozen internal acceptance is blocked",
        status: "ready",
      })),
    });
    assert.equal(unfrozenInternalAcceptanceProposal.response.status, 201);
    const unfrozenInternalAcceptance = await request(
      baseUrl,
      `/api/proposals/${unfrozenInternalAcceptanceProposal.body.data.id}/status`,
      writer.token,
      {
        method: "POST",
        body: JSON.stringify({
          status: "accepted",
          reason: "Accepted before freeze",
          acceptedByName: "Unfrozen Signer",
          acceptedByEmail: "unfrozen-signer@example.com",
          legalCompanyName: "Unfrozen Signer Ltd",
          billingEmail: "billing-unfrozen@example.com",
          agreementAccepted: true,
          confirmationText: "Unfrozen Signer",
        }),
      },
    );
    assert.equal(unfrozenInternalAcceptance.response.status, 409);
    assert.match(unfrozenInternalAcceptance.body.message, /sent and frozen/i);

    const directAcceptedV5 = await request(baseUrl, "/api/proposals", writer.token, {
      method: "POST",
      body: JSON.stringify(makeReadyProposalPayload(recommendedPackageId, proofAssetIds, {
        contactId,
        proposalName: "Direct accepted V5 without freeze",
        templateKey: "clinicgrower_v5",
        status: "accepted",
        acceptedByName: "Direct V5 Signer",
        acceptedByEmail: "direct-v5@example.com",
        legalCompanyName: "Direct V5 Ltd",
        billingEmail: "billing-direct-v5@example.com",
        agreementAccepted: true,
        confirmationText: "Direct V5 Signer",
      })),
    });
    assert.equal(directAcceptedV5.response.status, 409);
    assert.match(directAcceptedV5.body.message, /sent and frozen/i);

    const v5Proposal = await request(baseUrl, "/api/proposals", writer.token, {
      method: "POST",
      body: JSON.stringify(makeReadyProposalPayload(recommendedPackageId, proofAssetIds, {
        contactId,
        proposalName: "V5 frozen proposal",
        templateKey: "clinicgrower_v5",
        status: "ready",
      })),
    });
    assert.equal(v5Proposal.response.status, 201);
    assert.equal(v5Proposal.body.data.v5Snapshot, null);
    const prematureV5Share = await request(
      baseUrl,
      `/api/proposals/${v5Proposal.body.data.id}/share`,
      writer.token,
      { method: "POST" },
    );
    assert.equal(prematureV5Share.response.status, 400);
    assert.match(prematureV5Share.body.message, /frozen proposal version/i);

    const rejectedUnfrozenV5Accepted = await request(
      baseUrl,
      `/api/proposals/${v5Proposal.body.data.id}/status`,
      writer.token,
      {
        method: "POST",
        body: JSON.stringify({
          status: "accepted",
          reason: "Accepted before freeze",
          acceptedByName: "Unfrozen V5",
          acceptedByEmail: "unfrozen-v5@example.com",
          legalCompanyName: "Unfrozen V5 Ltd",
          billingEmail: "billing-unfrozen-v5@example.com",
          agreementAccepted: true,
          confirmationText: "Unfrozen V5",
        }),
      },
    );
    assert.equal(rejectedUnfrozenV5Accepted.response.status, 409);
    assert.match(rejectedUnfrozenV5Accepted.body.message, /sent and frozen/i);

    const rejectedUnfrozenV5Won = await request(
      baseUrl,
      `/api/proposals/${v5Proposal.body.data.id}/status`,
      writer.token,
      {
        method: "POST",
        body: JSON.stringify({
          status: "won",
          reason: "Won before freeze",
          acceptedByName: "Unfrozen V5",
          acceptedByEmail: "unfrozen-v5@example.com",
          legalCompanyName: "Unfrozen V5 Ltd",
          billingEmail: "billing-unfrozen-v5@example.com",
          agreementAccepted: true,
          confirmationText: "Unfrozen V5",
        }),
      },
    );
    assert.equal(rejectedUnfrozenV5Won.response.status, 409);
    assert.match(rejectedUnfrozenV5Won.body.message, /sent and frozen/i);

    const rejectedMissingReferenceV5 = await request(baseUrl, "/api/proposals", writer.token, {
      method: "POST",
      body: JSON.stringify(makeReadyProposalPayload(recommendedPackageId, proofAssetIds, {
        contactId,
        proposalName: "V5 missing proposal reference",
        templateKey: "clinicgrower_v5",
        status: "ready",
        sectionContent: {
          proposalReference: "",
        },
      })),
    });
    assert.equal(rejectedMissingReferenceV5.response.status, 400);
    assert.match(rejectedMissingReferenceV5.body.message, /proposal reference/i);

    const internalBrandPathV5 = await request(baseUrl, "/api/proposals", writer.token, {
      method: "POST",
      body: JSON.stringify(makeReadyProposalPayload(recommendedPackageId, proofAssetIds, {
        contactId,
        proposalName: "V5 accepts internal brand asset paths",
        templateKey: "clinicgrower_v5",
        sectionContent: {
          heroImageUrl: "/brand/proposal/v5-reference/dental_practices/p01-img02-1672x941.png",
          introVideoThumbnailUrl: "/brand/proposal/website-source/clinicgrower-os-video-thumbnail.jpg",
          sectorImages: [
            {
              slot: "cover",
              imageId: "dental-cover",
              url: "/brand/proposal/v5-reference/dental_practices/p01-img02-1672x941.png",
              cropPosition: "center center",
              licence: "ClinicGrower V5 reference asset pack",
              provenance: "ClinicGrower final V5 proposal PDFs",
              approvalStatus: "approved",
            },
            {
              slot: "journey",
              imageId: "dental-journey",
              url: "/brand/proposal/v5-reference/dental_practices/p06-img01-1009x1559.png",
              cropPosition: "center center",
              licence: "ClinicGrower V5 reference asset pack",
              provenance: "ClinicGrower final V5 proposal PDFs",
              approvalStatus: "approved",
            },
            {
              slot: "proof",
              imageId: "dental-proof",
              url: "/brand/proof/tanja-phillips.webp",
              cropPosition: "center center",
              licence: "ClinicGrower V5 proof library",
              provenance: "ClinicGrower approved proof asset",
              approvalStatus: "approved",
            },
            {
              slot: "close",
              imageId: "dental-planning",
              url: "/brand/proposal/v5-reference/dental_practices/p13-img01-1672x941.png",
              cropPosition: "center center",
              licence: "ClinicGrower V5 reference asset pack",
              provenance: "ClinicGrower final V5 proposal PDFs",
              approvalStatus: "approved",
            },
          ],
        },
      })),
    });
    assert.equal(internalBrandPathV5.response.status, 201);

    const internalProofMediaPath = await request(baseUrl, "/api/proposals/proof-assets", writer.token, {
      method: "POST",
      body: JSON.stringify({
        type: "team_image",
        title: `Internal proof media path ${uuidv4()}`,
        copy: "Regression coverage for approved internal proof asset media paths.",
        mediaUrl: "/brand/proof/tanja-phillips.webp",
        sectorTags: ["dental", "state:known"],
        sortOrder: 999,
        isActive: false,
      }),
    });
    assert.equal(internalProofMediaPath.response.status, 201);

    const rejectedUnsafeBrandPathV5 = await request(baseUrl, "/api/proposals", writer.token, {
      method: "POST",
      body: JSON.stringify(makeReadyProposalPayload(recommendedPackageId, proofAssetIds, {
        contactId,
        proposalName: "V5 rejects unsafe internal brand path",
        templateKey: "clinicgrower_v5",
        sectionContent: {
          heroImageUrl: "/brand/proposal/../private.png",
          introVideoThumbnailUrl: "/brand/proposal/website-source/clinicgrower-os-video-thumbnail.jpg",
        },
      })),
    });
    assert.equal(rejectedUnsafeBrandPathV5.response.status, 400);
    assert.match(JSON.stringify(rejectedUnsafeBrandPathV5.body.errors), /heroImageUrl must be a valid URL/i);

    const rejectedUnsafeProofMedia = await request(baseUrl, "/api/proposals/proof-assets", writer.token, {
      method: "POST",
      body: JSON.stringify({
        type: "team_image",
        title: `Unsafe proof media path ${uuidv4()}`,
        copy: "Regression coverage for unsafe proof asset media paths.",
        mediaUrl: "javascript://brand/proof/tanja-phillips.webp",
        sectorTags: ["dental"],
      }),
    });
    assert.equal(rejectedUnsafeProofMedia.response.status, 400);
    assert.match(JSON.stringify(rejectedUnsafeProofMedia.body.errors), /mediaUrl must be a valid URL/i);

    const v5Sent = await request(
      baseUrl,
      `/api/proposals/${v5Proposal.body.data.id}/send`,
      writer.token,
      {
        method: "POST",
        body: JSON.stringify({
          recipientEmail: "v5-signer@example.com",
          recipientName: "V5 Signer",
          sendMethod: "manual_email",
        }),
      },
    );
    assert.equal(v5Sent.response.status, 200);
    assert.equal(v5Sent.body.data.status, "sent");
    assert.equal(v5Sent.body.data.v5Snapshot.schemaVersion, "proposal_v5");
    assert.equal(v5Sent.body.data.v5Snapshot.proposal.reference, "CG-TEST-001");
    assert.equal(v5Sent.body.data.v5Snapshot.pageCount, 15);
    assert.match(v5Sent.body.data.v5SnapshotHash, /^[a-f0-9]{64}$/);
    assert.equal(v5Sent.body.data.v5Snapshot.snapshotHash, v5Sent.body.data.v5SnapshotHash);
    assert.equal(v5Sent.body.data.v5SnapshotVersion, "proposal_v5_2026_08_11");
    assert.ok(v5Sent.body.data.v5SnapshotFrozenAt);
    assert.equal(
      v5Sent.body.data.v5Snapshot.scope[0].title,
      "Package-owned dental growth operating system",
      "V5 snapshot must freeze package-catalogue scope when package scope exists",
    );
    const frozenV5Hash = v5Sent.body.data.v5SnapshotHash;
    const frozenV5Url = new URL(v5Sent.body.data.proposalUrl);
    const frozenV5Token = frozenV5Url.searchParams.get("token");
    assert.ok(frozenV5Token);
    const frozenRender = await request(baseUrl, `/api/proposals/${v5Proposal.body.data.id}/render`, writer.token);
    assert.equal(frozenRender.response.status, 200);
    assert.equal(frozenRender.body.data.frozen, true);
    assert.equal(frozenRender.body.data.v5Snapshot.snapshotHash, frozenV5Hash);

    const v5PrintArchive = await request(
      baseUrl,
      `/api/proposals/render-archive?search=${encodeURIComponent("V5 frozen proposal")}`,
      writer.token,
    );
    assert.equal(v5PrintArchive.response.status, 200);
    const archivedV5 = v5PrintArchive.body.data.find((item: any) => item.proposalId === v5Proposal.body.data.id);
    assert.ok(archivedV5);
    assert.equal(archivedV5.artifactType, "v5_print_pdf");
    assert.equal(archivedV5.proposalReference, "CG-TEST-001");
    assert.equal(archivedV5.snapshotHash, frozenV5Hash);
    assert.equal(archivedV5.snapshotVersion, "proposal_v5_2026_08_11");
    assert.equal(archivedV5.pageCount, 15);
    assert.match(archivedV5.printUrl, /\/app\/crm\/proposals\/v5-print-preview\?proposalId=/);

    const otherTenantV5PrintArchive = await request(
      baseUrl,
      `/api/proposals/render-archive?search=${encodeURIComponent("V5 frozen proposal")}`,
      otherWriter.token,
    );
    assert.equal(otherTenantV5PrintArchive.response.status, 200);
    assert.equal(otherTenantV5PrintArchive.body.data.length, 0);

    const createSentV5AcceptanceCase = async (proposalName: string) => {
      const proposal = await request(baseUrl, "/api/proposals", writer.token, {
        method: "POST",
        body: JSON.stringify(makeReadyProposalPayload(recommendedPackageId, proofAssetIds, {
          contactId,
          proposalName,
          templateKey: "clinicgrower_v5",
          status: "ready",
        })),
      });
      assert.equal(proposal.response.status, 201);
      const sent = await request(
        baseUrl,
        `/api/proposals/${proposal.body.data.id}/send`,
        writer.token,
        {
          method: "POST",
          body: JSON.stringify({
            recipientEmail: `${proposal.body.data.id}@v5-negative.test`,
            recipientName: proposalName,
            sendMethod: "manual_email",
          }),
        },
      );
      assert.equal(sent.response.status, 200);
      const token = new URL(sent.body.data.proposalUrl).searchParams.get("token");
      assert.ok(token);
      return { id: proposal.body.data.id as string, token };
    };

    const legacyFrozenShapeProposal = await createSentV5AcceptanceCase("V5 resend rejects historical frozen snapshot");
    await pool.execute(
      `UPDATE proposal
       SET v5_snapshot = JSON_SET(v5_snapshot, '$.pageCount', 19),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND clinic_id = ?`,
      [legacyFrozenShapeProposal.id, primaryClinicId],
    );
    const rejectedHistoricalFrozenResend = await request(
      baseUrl,
      `/api/proposals/${legacyFrozenShapeProposal.id}/send`,
      writer.token,
      {
        method: "POST",
        body: JSON.stringify({
          recipientEmail: "historical-frozen@example.com",
          recipientName: "Historical Frozen",
          sendMethod: "manual_email",
        }),
      },
    );
    assert.equal(rejectedHistoricalFrozenResend.response.status, 409);
    assert.match(rejectedHistoricalFrozenResend.body.message, /already been frozen/i);
    const historicalFrozenValidation = await request(
      baseUrl,
      `/api/proposals/${legacyFrozenShapeProposal.id}/validate`,
      writer.token,
      { method: "POST" },
    );
    assert.equal(historicalFrozenValidation.response.status, 200);
    assert.equal(historicalFrozenValidation.body.data.frozen, true);
    assert.equal(historicalFrozenValidation.body.data.ready, false);
    assert.equal(historicalFrozenValidation.body.data.canRenderV5, false);
    assert.match(
      historicalFrozenValidation.body.data.issues.join(" "),
      /Frozen V5 snapshot is not renderable/i,
    );
    const historicalFrozenRender = await request(
      baseUrl,
      `/api/proposals/${legacyFrozenShapeProposal.id}/render`,
      writer.token,
    );
    assert.equal(historicalFrozenRender.response.status, 200);
    assert.equal(historicalFrozenRender.body.data.frozen, true);
    assert.equal(historicalFrozenRender.body.data.v5Snapshot, null);

    const publicV5AcceptancePayload = {
      fullName: "V5 Signer",
      email: "v5-signer@example.com",
      legalCompanyName: "V5 Signer Ltd",
      billingEmail: "billing-v5@example.com",
      preferredStartDate: "2026-08-20",
      agreementAccepted: true,
      signatureConfirmation: "V5 Signer",
    };

    const unsentV5Case = await createSentV5AcceptanceCase("V5 public acceptance rejects unsent");
    await pool.execute(
      `UPDATE proposal
       SET status = 'ready',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND clinic_id = ?`,
      [unsentV5Case.id, primaryClinicId],
    );
    const rejectedUnsentPublicV5Acceptance = await requestPublic(
      baseUrl,
      `/api/proposals/shared/${encodeURIComponent(unsentV5Case.token)}/accept`,
      {
        method: "POST",
        body: JSON.stringify(publicV5AcceptancePayload),
      },
    );
    assert.equal(rejectedUnsentPublicV5Acceptance.response.status, 404);

    const missingSnapshotV5Case = await createSentV5AcceptanceCase("V5 public acceptance rejects missing snapshot");
    await pool.execute(
      `UPDATE proposal
       SET v5_snapshot = NULL,
           v5_snapshot_hash = NULL,
           v5_snapshot_version = NULL,
           v5_snapshot_frozen_at = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND clinic_id = ?`,
      [missingSnapshotV5Case.id, primaryClinicId],
    );
    const rejectedMissingSnapshotPublicV5Acceptance = await requestPublic(
      baseUrl,
      `/api/proposals/shared/${encodeURIComponent(missingSnapshotV5Case.token)}/accept`,
      {
        method: "POST",
        body: JSON.stringify(publicV5AcceptancePayload),
      },
    );
    assert.equal(rejectedMissingSnapshotPublicV5Acceptance.response.status, 404);

    const hashMismatchV5Case = await createSentV5AcceptanceCase("V5 public acceptance rejects hash mismatch");
    await pool.execute(
      `UPDATE proposal
       SET v5_snapshot_hash = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND clinic_id = ?`,
      ["0".repeat(64), hashMismatchV5Case.id, primaryClinicId],
    );
    const rejectedHashMismatchPublicV5Acceptance = await requestPublic(
      baseUrl,
      `/api/proposals/shared/${encodeURIComponent(hashMismatchV5Case.token)}/accept`,
      {
        method: "POST",
        body: JSON.stringify(publicV5AcceptancePayload),
      },
    );
    assert.equal(rejectedHashMismatchPublicV5Acceptance.response.status, 404);

    const corruptSnapshotV5Case = await createSentV5AcceptanceCase("V5 public acceptance rejects corrupt snapshot");
    await pool.execute(
      `UPDATE proposal
       SET v5_snapshot = JSON_SET(v5_snapshot, '$.pageCount', 18),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND clinic_id = ?`,
      [corruptSnapshotV5Case.id, primaryClinicId],
    );
    const rejectedCorruptPublicV5Acceptance = await requestPublic(
      baseUrl,
      `/api/proposals/shared/${encodeURIComponent(corruptSnapshotV5Case.token)}/accept`,
      {
        method: "POST",
        body: JSON.stringify(publicV5AcceptancePayload),
      },
    );
    assert.equal(rejectedCorruptPublicV5Acceptance.response.status, 404);

    const rejectedV5Mutation = await request(
      baseUrl,
      `/api/proposals/${v5Proposal.body.data.id}`,
      writer.token,
      {
        method: "PATCH",
        body: JSON.stringify({ proposalName: "Changed V5 client-facing copy" }),
      },
    );
    assert.equal(rejectedV5Mutation.response.status, 409);
    const v5AfterRejectedMutation = await request(
      baseUrl,
      `/api/proposals/${v5Proposal.body.data.id}`,
      writer.token,
    );
    assert.equal(v5AfterRejectedMutation.body.data.v5SnapshotHash, frozenV5Hash);

    const publicV5Preview = await requestPublic(
      baseUrl,
      `/api/proposals/shared/${encodeURIComponent(frozenV5Token)}`,
    );
    assert.equal(publicV5Preview.response.status, 200);
    const publicV5Snapshot = publicV5Preview.body.data.proposal.v5Snapshot;
    assert.equal(publicV5Preview.body.data.proposal.sectionContent, null);
    assert.equal(publicV5Preview.body.data.proposal.coreData, null);
    assert.equal(publicV5Snapshot.schemaVersion, "proposal_v5");
    assert.equal(publicV5Snapshot.proposal.reference, "CG-TEST-001");
    assert.equal(Object.hasOwn(publicV5Snapshot, "snapshotHash"), false);
    assert.equal(Object.hasOwn(publicV5Snapshot, "sourceProposalVersion"), false);
    assert.equal(Object.hasOwn(publicV5Snapshot.selectedPackage, "id"), false);
    assert.equal(Object.hasOwn(publicV5Snapshot.selectedPackage, "catalogueVersion"), false);
    assert.equal(
      publicV5Snapshot.proof.some((asset: any) => Object.hasOwn(asset, "id")),
      false,
      "public V5 snapshot must not expose proof asset IDs",
    );
    assert.equal(publicV5Snapshot.assets.osScreens.some((image: any) => Object.hasOwn(image, "imageId")), false);
    assert.equal(Object.hasOwn(publicV5Snapshot.assets.founderVideoThumbnail, "imageId"), false);
    assert.equal(Object.hasOwn(publicV5Snapshot.assets.postBookingScreenshot, "imageId"), false);
    assert.equal(Object.hasOwn(publicV5Snapshot.assets.implementationImage, "imageId"), false);

    await pool.execute(
      `UPDATE proposal
       SET proposal_name = 'Mutable V5 name after send must not change frozen snapshot',
           monthly_fee_cents = 1,
           section_content = JSON_SET(section_content, '$.customerWording', 'Mutable section content after send must not change frozen snapshot'),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND clinic_id = ?`,
      [v5Proposal.body.data.id, primaryClinicId],
    );

    const publicV5Acceptance = await requestPublic(
      baseUrl,
      `/api/proposals/shared/${encodeURIComponent(frozenV5Token)}/accept`,
      {
        method: "POST",
        body: JSON.stringify(publicV5AcceptancePayload),
      },
    );
    assert.equal(publicV5Acceptance.response.status, 200);
    const acceptedV5Internal = await request(
      baseUrl,
      `/api/proposals/${v5Proposal.body.data.id}`,
      writer.token,
    );
    assert.equal(acceptedV5Internal.response.status, 200);
    assert.equal(acceptedV5Internal.body.data.status, "accepted");
    assert.equal(acceptedV5Internal.body.data.v5SnapshotHash, frozenV5Hash);
    assert.equal(acceptedV5Internal.body.data.acceptanceRecord.v5SnapshotHash, frozenV5Hash);
    assert.equal(acceptedV5Internal.body.data.acceptanceRecord.v5SnapshotVersion, "proposal_v5_2026_08_11");
    assert.equal(acceptedV5Internal.body.data.acceptanceRecord.v5Snapshot.schemaVersion, "proposal_v5");
    assert.equal(acceptedV5Internal.body.data.acceptanceRecord.v5Snapshot.proposal.reference, "CG-TEST-001");
    assert.deepEqual(
      acceptedV5Internal.body.data.acceptanceRecord.v5Snapshot,
      v5Sent.body.data.v5Snapshot,
      "accepted V5 record must store the exact frozen snapshot that was sent",
    );
    assert.equal(
      acceptedV5Internal.body.data.acceptanceRecord.v5Snapshot.discovery.customerWording.value,
      v5Sent.body.data.v5Snapshot.discovery.customerWording.value,
      "mutable CRM/editor data changed after send must not alter the accepted V5 snapshot",
    );
    assert.equal(
      acceptedV5Internal.body.data.acceptanceRecord.v5Snapshot.selectedPackage.monthlyFeeCents,
      v5Sent.body.data.v5Snapshot.selectedPackage.monthlyFeeCents,
    );

    const replacementV5Proposal = await request(baseUrl, "/api/proposals", writer.token, {
      method: "POST",
      body: JSON.stringify(makeReadyProposalPayload(recommendedPackageId, proofAssetIds, {
        contactId,
        proposalName: "V5 replacement version",
        templateKey: "clinicgrower_v5",
        status: "ready",
        sectionContent: {
          customerWording: "Replacement version has updated discovery wording before send.",
        },
      })),
    });
    assert.equal(replacementV5Proposal.response.status, 201);
    const replacementV5Sent = await request(
      baseUrl,
      `/api/proposals/${replacementV5Proposal.body.data.id}/send`,
      writer.token,
      {
        method: "POST",
        body: JSON.stringify({
          recipientEmail: "replacement-v5@example.com",
          recipientName: "Replacement V5",
          sendMethod: "manual_email",
        }),
      },
    );
    assert.equal(replacementV5Sent.response.status, 200);
    assert.notEqual(
      replacementV5Sent.body.data.v5SnapshotHash,
      frozenV5Hash,
      "a replacement V5 proposal must create a separate frozen snapshot",
    );

    const internalAcceptedV5Proposal = await request(baseUrl, "/api/proposals", writer.token, {
      method: "POST",
      body: JSON.stringify(makeReadyProposalPayload(recommendedPackageId, proofAssetIds, {
        contactId,
        proposalName: "V5 internal accepted after freeze",
        templateKey: "clinicgrower_v5",
        status: "ready",
      })),
    });
    assert.equal(internalAcceptedV5Proposal.response.status, 201);
    const internalAcceptedV5Sent = await request(
      baseUrl,
      `/api/proposals/${internalAcceptedV5Proposal.body.data.id}/send`,
      writer.token,
      {
        method: "POST",
        body: JSON.stringify({
          recipientEmail: "internal-v5@example.com",
          recipientName: "Internal V5",
          sendMethod: "manual_email",
        }),
      },
    );
    assert.equal(internalAcceptedV5Sent.response.status, 200);
    const internalAcceptedV5 = await request(
      baseUrl,
      `/api/proposals/${internalAcceptedV5Proposal.body.data.id}/status`,
      writer.token,
      {
        method: "POST",
        body: JSON.stringify({
          status: "accepted",
          reason: "Accepted after freeze",
          acceptedByName: "Internal V5",
          acceptedByEmail: "internal-v5@example.com",
          legalCompanyName: "Internal V5 Ltd",
          billingEmail: "billing-internal-v5@example.com",
          preferredStartDate: "2026-08-25",
          agreementAccepted: true,
          confirmationText: "Internal V5",
        }),
      },
    );
    assert.equal(internalAcceptedV5.response.status, 200);
    assert.equal(internalAcceptedV5.body.data.status, "accepted");
    assert.equal(internalAcceptedV5.body.data.acceptanceRecord.v5SnapshotHash, internalAcceptedV5Sent.body.data.v5SnapshotHash);

    const publicAcceptedMutation = await request(
      baseUrl,
      `/api/proposals/${publicAcceptedProposal.body.data.id}`,
      writer.token,
      {
        method: "PATCH",
        body: JSON.stringify({ proposalName: "Changed after acceptance" }),
      },
    );
    assert.equal(publicAcceptedMutation.response.status, 409);
    assert.match(publicAcceptedMutation.body.message, /accepted version is locked/i);

    const updated = await request(baseUrl, `/api/proposals/${created.body.data.id}`, writer.token, {
      method: "PATCH",
      body: JSON.stringify({
        status: "follow_up_due",
        followUpAt: "2026-07-24T09:00:00.000Z",
      }),
    });
    assert.equal(updated.response.status, 200);
    assert.equal(updated.body.data.status, "follow_up_due");
    assert.equal(updated.body.data.contactId, contactId);
    const [proposalAuditRows]: any = await pool.execute(
      `SELECT
          JSON_UNQUOTE(JSON_EXTRACT(changes, '$.status.before')) as previousStatus,
          JSON_UNQUOTE(JSON_EXTRACT(changes, '$.status.after')) as status
       FROM audit_log
       WHERE clinic_id = ?
         AND user_id = ?
         AND entity_type = 'proposal'
         AND entity_id = ?
         AND action = 'PROPOSAL_STATUS_CHANGED'
         AND JSON_UNQUOTE(JSON_EXTRACT(changes, '$.status.after')) = 'follow_up_due'
       ORDER BY created_at DESC
       LIMIT 1`,
      [primaryClinicId, writer.id, created.body.data.id],
    );
    assert.equal(proposalAuditRows.length, 1);
    assert.equal(proposalAuditRows[0].previousStatus, "viewed");
    assert.equal(proposalAuditRows[0].status, "follow_up_due");
    const [customStageRows]: any = await pool.execute(
      `SELECT pipeline_stage_id as stageId, stage
       FROM deal
       WHERE id = ? AND clinic_id = ?`,
      [dealId, primaryClinicId],
    );
    assert.equal(
      customStageRows[0].stageId,
      customProposalStageId,
      "proposal follow-up must use the configured last open stage when labels are custom",
    );
    assert.equal(customStageRows[0].stage, "Final Gate");

    const rollbackProposal = await request(baseUrl, "/api/proposals", writer.token, {
      method: "POST",
      body: JSON.stringify(makeReadyProposalPayload(recommendedPackageId, proofAssetIds, {
        contactId: rollbackContactId,
        dealId: rollbackDealId,
        proposalName: "Atomic acceptance rollback",
        status: "ready",
        followUpAt: "2026-08-03T09:00:00.000Z",
        valueCents: 90000,
        monthlyFeeCents: 90000,
        currency: "GBP",
      })),
    });
    assert.equal(rollbackProposal.response.status, 201);
    const rollbackProposalSent = await request(
      baseUrl,
      `/api/proposals/${rollbackProposal.body.data.id}/send`,
      writer.token,
      {
        method: "POST",
        body: JSON.stringify({
          recipientEmail: "atomic@example.com",
          recipientName: "Atomic Tester",
          sendMethod: "manual_email",
        }),
      },
    );
    assert.equal(rollbackProposalSent.response.status, 200);
    assert.equal(rollbackProposalSent.body.data.v5Snapshot.schemaVersion, "proposal_v5");

    const [rollbackBaselineRows]: any = await pool.execute(
      `SELECT
         (SELECT COUNT(*) FROM activity
          WHERE clinic_id = ? AND contact_id = ?) as activityCount,
         (SELECT COUNT(*) FROM audit_log
          WHERE clinic_id = ?) as auditCount,
         (SELECT COUNT(*) FROM pipeline_deal_movement
          WHERE clinic_id = ? AND deal_id = ?) as movementCount,
         (SELECT COUNT(*) FROM audit_log
          WHERE clinic_id = ?
            AND entity_id = ?
            AND action IN ('PIPELINE_DEAL_MOVED', 'PROPOSAL_SYNCED_DEAL_STAGE')) as dealAuditCount,
         (SELECT pipeline_stage_id FROM deal
          WHERE clinic_id = ? AND id = ?) as dealStageId,
         (SELECT status FROM deal
          WHERE clinic_id = ? AND id = ?) as dealStatus,
         (SELECT client_account_profile_id FROM deal
          WHERE clinic_id = ? AND id = ?) as dealProfileId,
         (SELECT status FROM task
          WHERE clinic_id = ? AND template_key = ? AND deleted_at IS NULL
          LIMIT 1) as followUpStatus`,
      [
        primaryClinicId,
        rollbackContactId,
        primaryClinicId,
        primaryClinicId,
        rollbackDealId,
        primaryClinicId,
        rollbackDealId,
        primaryClinicId,
        rollbackDealId,
        primaryClinicId,
        rollbackDealId,
        primaryClinicId,
        rollbackDealId,
        primaryClinicId,
        `proposal_follow_up:${rollbackProposal.body.data.id}`,
      ],
    );
    assert.equal(rollbackBaselineRows[0].followUpStatus, "pending");

    await pool.query("DROP TRIGGER IF EXISTS test_proposal_atomic_failure");
    await pool.query(
      `CREATE TRIGGER test_proposal_atomic_failure
       BEFORE INSERT ON clinic
       FOR EACH ROW
       SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'forced proposal acceptance rollback'`,
    );
    try {
      const failedAcceptance = await request(
        baseUrl,
        `/api/proposals/${rollbackProposal.body.data.id}/status`,
        writer.token,
        {
          method: "POST",
          body: JSON.stringify({
            status: "accepted",
            reason: "Should roll back",
            acceptedByName: "Atomic Tester",
            acceptedByEmail: "atomic@example.com",
          }),
        },
      );
      assert.equal(failedAcceptance.response.status, 500);
    } finally {
      await pool.query("DROP TRIGGER IF EXISTS test_proposal_atomic_failure");
    }

    const [rolledBackRows]: any = await pool.execute(
      `SELECT
         (SELECT status FROM proposal WHERE id = ? AND clinic_id = ?) as proposalStatus,
         (SELECT COUNT(*) FROM proposal_acceptance_record
          WHERE proposal_id = ? AND clinic_id = ? AND deleted_at IS NULL) as acceptanceCount,
         (SELECT pipeline_stage_id FROM deal WHERE id = ? AND clinic_id = ?) as dealStageId,
         (SELECT status FROM deal WHERE id = ? AND clinic_id = ?) as dealStatus,
         (SELECT client_account_profile_id FROM deal WHERE id = ? AND clinic_id = ?) as dealProfileId,
         (SELECT COUNT(*) FROM activity
          WHERE clinic_id = ? AND contact_id = ?) as activityCount,
         (SELECT COUNT(*) FROM audit_log
          WHERE clinic_id = ?) as auditCount,
         (SELECT COUNT(*) FROM pipeline_deal_movement
          WHERE clinic_id = ? AND deal_id = ?) as movementCount,
         (SELECT status FROM task
          WHERE clinic_id = ? AND template_key = ? AND deleted_at IS NULL
          LIMIT 1) as followUpStatus,
         (SELECT completed_at FROM task
          WHERE clinic_id = ? AND template_key = ? AND deleted_at IS NULL
          LIMIT 1) as followUpCompletedAt,
         (SELECT COUNT(*) FROM client_account_contact
          WHERE clinic_id = ? AND contact_id = ?) as clientLinkCount,
         (SELECT COUNT(*) FROM clinic
          WHERE name = 'Atomic Rollback Clinic' AND deleted_at IS NULL) as convertedClinicCount`,
      [
        rollbackProposal.body.data.id,
        primaryClinicId,
        rollbackProposal.body.data.id,
        primaryClinicId,
        rollbackDealId,
        primaryClinicId,
        rollbackDealId,
        primaryClinicId,
        rollbackDealId,
        primaryClinicId,
        primaryClinicId,
        rollbackContactId,
        primaryClinicId,
        primaryClinicId,
        rollbackDealId,
        primaryClinicId,
        `proposal_follow_up:${rollbackProposal.body.data.id}`,
        primaryClinicId,
        `proposal_follow_up:${rollbackProposal.body.data.id}`,
        primaryClinicId,
        rollbackContactId,
      ],
    );
    assert.equal(rolledBackRows[0].proposalStatus, "sent");
    assert.equal(Number(rolledBackRows[0].acceptanceCount), 0);
    assert.equal(rolledBackRows[0].dealStageId, rollbackBaselineRows[0].dealStageId);
    assert.equal(rolledBackRows[0].dealStatus, rollbackBaselineRows[0].dealStatus);
    assert.equal(rolledBackRows[0].dealProfileId, rollbackBaselineRows[0].dealProfileId);
    assert.equal(Number(rolledBackRows[0].activityCount), Number(rollbackBaselineRows[0].activityCount));
    assert.equal(Number(rolledBackRows[0].auditCount), Number(rollbackBaselineRows[0].auditCount));
    assert.equal(Number(rolledBackRows[0].movementCount), Number(rollbackBaselineRows[0].movementCount));
    assert.equal(rolledBackRows[0].followUpStatus, "pending");
    assert.equal(rolledBackRows[0].followUpCompletedAt, null);
    assert.equal(Number(rolledBackRows[0].clientLinkCount), 0);
    assert.equal(Number(rolledBackRows[0].convertedClinicCount), 0);

    const linkedLost = await request(
      baseUrl,
      `/api/proposals/${rollbackProposal.body.data.id}/status`,
      writer.token,
      {
        method: "POST",
        body: JSON.stringify({
          status: "lost",
          reason: "budget",
          objectionType: "budget",
        }),
      },
    );
    assert.equal(linkedLost.response.status, 200);
    assert.equal(linkedLost.body.data.status, "lost");
    const [linkedLostRows]: any = await pool.execute(
      `SELECT
         (SELECT pipeline_stage_id FROM deal WHERE id = ? AND clinic_id = ?) as dealStageId,
         (SELECT status FROM deal WHERE id = ? AND clinic_id = ?) as dealStatus,
         (SELECT lost_reason FROM deal WHERE id = ? AND clinic_id = ?) as dealLostReason,
         (SELECT objection_type FROM deal WHERE id = ? AND clinic_id = ?) as dealObjectionType,
         (SELECT lead_status FROM contact WHERE id = ? AND clinic_id = ?) as contactLeadStatus,
         (SELECT lost_reason FROM contact WHERE id = ? AND clinic_id = ?) as contactLostReason,
         (SELECT objection_type FROM contact WHERE id = ? AND clinic_id = ?) as contactObjectionType,
         (SELECT status FROM task
          WHERE clinic_id = ? AND template_key = ? AND deleted_at IS NULL
          LIMIT 1) as followUpStatus,
         (SELECT COUNT(*) FROM pipeline_deal_movement
          WHERE clinic_id = ? AND deal_id = ?) as movementCount,
         (SELECT COUNT(*) FROM activity
          WHERE clinic_id = ?
            AND contact_id = ?
            AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.action')) = 'lead_stage_changed'
            AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.recordId')) = ?) as stageActivityCount,
         (SELECT COUNT(*) FROM audit_log
          WHERE clinic_id = ?
            AND entity_id = ?
            AND action IN ('PIPELINE_DEAL_MOVED', 'PROPOSAL_SYNCED_DEAL_STAGE')) as dealAuditCount`,
      [
        rollbackDealId,
        primaryClinicId,
        rollbackDealId,
        primaryClinicId,
        rollbackDealId,
        primaryClinicId,
        rollbackDealId,
        primaryClinicId,
        rollbackContactId,
        primaryClinicId,
        rollbackContactId,
        primaryClinicId,
        rollbackContactId,
        primaryClinicId,
        primaryClinicId,
        `proposal_follow_up:${rollbackProposal.body.data.id}`,
        primaryClinicId,
        rollbackDealId,
        primaryClinicId,
        rollbackContactId,
        rollbackDealId,
        primaryClinicId,
        rollbackDealId,
      ],
    );
    assert.equal(linkedLostRows[0].dealStageId, lostStageId);
    assert.equal(linkedLostRows[0].dealStatus, "lost");
    assert.equal(linkedLostRows[0].dealLostReason, "budget");
    assert.equal(linkedLostRows[0].dealObjectionType, "budget");
    assert.equal(linkedLostRows[0].contactLeadStatus, "lost");
    assert.equal(linkedLostRows[0].contactLostReason, "budget");
    assert.equal(linkedLostRows[0].contactObjectionType, "budget");
    assert.equal(linkedLostRows[0].followUpStatus, "completed");
    assert.equal(Number(linkedLostRows[0].movementCount), Number(rollbackBaselineRows[0].movementCount) + 1);
    assert.equal(Number(linkedLostRows[0].stageActivityCount), 1);
    assert.equal(Number(linkedLostRows[0].dealAuditCount), Number(rollbackBaselineRows[0].dealAuditCount) + 2);

    const repeatedLostProposal = await request(baseUrl, "/api/proposals", writer.token, {
      method: "POST",
      body: JSON.stringify(makeReadyProposalPayload(recommendedPackageId, proofAssetIds, {
        contactId: rollbackContactId,
        dealId: rollbackDealId,
        proposalName: "Repeated linked Lost outcome",
        status: "ready",
        valueCents: 25000,
        monthlyFeeCents: 25000,
        currency: "GBP",
      })),
    });
    assert.equal(repeatedLostProposal.response.status, 201);
    await pool.execute(
      `UPDATE deal
       SET lost_reason = 'budget',
           objection_type = 'budget'
       WHERE id = ? AND clinic_id = ?`,
      [rollbackDealId, primaryClinicId],
    );
    const repeatedLinkedLost = await request(
      baseUrl,
      `/api/proposals/${repeatedLostProposal.body.data.id}/status`,
      writer.token,
      {
        method: "POST",
        body: JSON.stringify({
          status: "lost",
          reason: "timing",
          objectionType: "timing",
        }),
      },
    );
    assert.equal(repeatedLinkedLost.response.status, 200);
    const [repeatedLinkedLostRows]: any = await pool.execute(
      `SELECT d.pipeline_stage_id as stageId,
              d.status,
              d.lost_reason as lostReason,
              d.objection_type as objectionType,
              c.lost_reason as contactLostReason,
              c.objection_type as contactObjectionType,
              (
                SELECT COUNT(*)
                FROM pipeline_deal_movement movement
                WHERE movement.clinic_id = d.clinic_id
                  AND movement.deal_id = d.id
              ) as movementCount
       FROM deal d
       JOIN contact c
         ON c.id = d.contact_id
        AND c.clinic_id = d.clinic_id
       WHERE d.id = ?
         AND d.clinic_id = ?`,
      [rollbackDealId, primaryClinicId],
    );
    assert.equal(repeatedLinkedLostRows[0].stageId, lostStageId);
    assert.equal(repeatedLinkedLostRows[0].status, "lost");
    assert.equal(repeatedLinkedLostRows[0].lostReason, "timing");
    assert.equal(repeatedLinkedLostRows[0].objectionType, "timing");
    assert.equal(repeatedLinkedLostRows[0].contactLostReason, "timing");
    assert.equal(repeatedLinkedLostRows[0].contactObjectionType, "timing");
    assert.equal(
      Number(repeatedLinkedLostRows[0].movementCount),
      Number(linkedLostRows[0].movementCount),
      "refreshing a Lost outcome must not create a duplicate stage movement",
    );

    await pool.execute(
      `UPDATE deal
       SET pipeline_stage_id = ?,
           stage = 'Open',
           status = 'open'
       WHERE id = ?
         AND clinic_id = ?`,
      [openStageId, rollbackDealId, primaryClinicId],
    );
    const reopenedDealProposal = await request(baseUrl, "/api/proposals", writer.token, {
      method: "POST",
      body: JSON.stringify(makeReadyProposalPayload(recommendedPackageId, proofAssetIds, {
        contactId: rollbackContactId,
        dealId: rollbackDealId,
        proposalName: "Reopened opportunity proposal",
        status: "ready",
        valueCents: 35000,
        monthlyFeeCents: 35000,
        currency: "GBP",
      })),
    });
    assert.equal(reopenedDealProposal.response.status, 201);
    const reopenedDealSent = await request(
      baseUrl,
      `/api/proposals/${reopenedDealProposal.body.data.id}/send`,
      writer.token,
      {
        method: "POST",
        body: JSON.stringify({
          recipientEmail: "reopened@example.com",
          recipientName: "Reopened Opportunity",
          sendMethod: "manual_email",
        }),
      },
    );
    assert.equal(reopenedDealSent.response.status, 200);
    assert.equal(reopenedDealSent.body.data.status, "sent");
    const [reopenedDealRows]: any = await pool.execute(
      `SELECT pipeline_stage_id as stageId,
              status,
              lost_reason as lostReason,
              objection_type as objectionType
       FROM deal
       WHERE id = ?
         AND clinic_id = ?`,
      [rollbackDealId, primaryClinicId],
    );
    assert.equal(reopenedDealRows[0].stageId, customProposalStageId);
    assert.equal(reopenedDealRows[0].status, "open");
    assert.equal(reopenedDealRows[0].lostReason, "timing");
    assert.equal(reopenedDealRows[0].objectionType, "timing");

    await pool.execute(
      `UPDATE deal
       SET pipeline_stage_id = ?,
           stage = 'Open',
           status = 'open'
       WHERE id = ?
         AND clinic_id = ?`,
      [openStageId, rollbackDealId, primaryClinicId],
    );
    const openStageRaceProposal = await request(baseUrl, "/api/proposals", writer.token, {
      method: "POST",
      body: JSON.stringify(makeReadyProposalPayload(recommendedPackageId, proofAssetIds, {
        contactId: rollbackContactId,
        dealId: rollbackDealId,
        proposalName: "Terminal stage race proposal",
        status: "ready",
        valueCents: 36000,
        monthlyFeeCents: 36000,
        currency: "GBP",
      })),
    });
    assert.equal(openStageRaceProposal.response.status, 201);
    const [openStageRaceBaselineRows]: any = await pool.execute(
      `SELECT COUNT(*) as movementCount
       FROM pipeline_deal_movement
       WHERE clinic_id = ?
         AND deal_id = ?`,
      [primaryClinicId, rollbackDealId],
    );
    await pool.query("DROP TRIGGER IF EXISTS test_proposal_open_stage_race");
    await pool.query(
      `CREATE TRIGGER test_proposal_open_stage_race
       BEFORE UPDATE ON deal
       FOR EACH ROW
       SET @proposal_open_stage_race_delay =
         IF(OLD.id = '${rollbackDealId}' AND NEW.status = 'lost', SLEEP(1.5), 0)`,
    );
    let terminalDealMove: Awaited<ReturnType<typeof pipelineDealsService.moveDeal>>;
    let sentDuringTerminalMove: Awaited<ReturnType<typeof request>>;
    try {
      const terminalDealMovePromise = pipelineDealsService.moveDeal(
        primaryClinicId,
        writer.id,
        rollbackDealId,
        {
          stageId: lostStageId,
          lostReason: "competitor",
          objectionType: "competitor",
        },
      );
      await new Promise((resolve) => setTimeout(resolve, 100));
      [terminalDealMove, sentDuringTerminalMove] = await Promise.all([
        terminalDealMovePromise,
        request(
          baseUrl,
          `/api/proposals/${openStageRaceProposal.body.data.id}/send`,
          writer.token,
          {
            method: "POST",
            body: JSON.stringify({
              recipientEmail: "terminal-race@example.com",
              recipientName: "Terminal Race",
              sendMethod: "manual_email",
            }),
          },
        ),
      ]);
    } finally {
      await pool.query("DROP TRIGGER IF EXISTS test_proposal_open_stage_race");
    }
    assert.equal(terminalDealMove.status, "lost");
    assert.equal(sentDuringTerminalMove.response.status, 200);
    assert.equal(sentDuringTerminalMove.body.data.status, "sent");
    const [openStageRaceRows]: any = await pool.execute(
      `SELECT d.pipeline_stage_id as stageId,
              d.status,
              d.lost_reason as lostReason,
              d.objection_type as objectionType,
              (
                SELECT COUNT(*)
                FROM pipeline_deal_movement movement
                WHERE movement.clinic_id = d.clinic_id
                  AND movement.deal_id = d.id
              ) as movementCount,
              (
                SELECT COUNT(*)
                FROM audit_log audit
                WHERE audit.clinic_id = d.clinic_id
                  AND audit.entity_id = d.id
                  AND audit.action = 'PROPOSAL_SYNCED_DEAL_STAGE'
                  AND JSON_UNQUOTE(JSON_EXTRACT(audit.changes, '$.proposalId')) = ?
              ) as proposalSyncAuditCount
       FROM deal d
       WHERE d.id = ?
         AND d.clinic_id = ?`,
      [openStageRaceProposal.body.data.id, rollbackDealId, primaryClinicId],
    );
    assert.equal(openStageRaceRows[0].stageId, lostStageId);
    assert.equal(openStageRaceRows[0].status, "lost");
    assert.equal(openStageRaceRows[0].lostReason, "competitor");
    assert.equal(openStageRaceRows[0].objectionType, "competitor");
    assert.equal(
      Number(openStageRaceRows[0].movementCount),
      Number(openStageRaceBaselineRows[0].movementCount) + 1,
      "proposal synchronization must not add a phantom movement after a terminal move wins",
    );
    assert.equal(Number(openStageRaceRows[0].proposalSyncAuditCount), 0);

    const accepted = await request(baseUrl, `/api/proposals/${created.body.data.id}/status`, writer.token, {
      method: "POST",
      body: JSON.stringify({
        status: "accepted",
        reason: "Email acceptance",
        acceptedByName: "Week Two Owner",
        acceptedByEmail: "owner@example.com",
        acceptedAt: "2026-07-25T10:00:00.000Z",
        paymentTerms: "Monthly in advance, setup due before kickoff.",
      }),
    });
    assert.equal(accepted.response.status, 200);
    assert.equal(accepted.body.data.status, "accepted");
    assert.equal(accepted.body.data.acceptanceRecord.acceptedByName, "Week Two Owner");
    assert.equal(accepted.body.data.acceptanceRecord.acceptedByEmail, "owner@example.com");
    assert.equal(accepted.body.data.acceptanceRecord.packageName, "Clinic Growth Engine");
    assert.equal(accepted.body.data.acceptanceRecord.monthlyFeeCents, 125000);
    assert.equal(accepted.body.data.acceptanceRecord.setupFeeCents, 0);
    assert.equal(accepted.body.data.acceptanceRecord.paymentTerms, "Monthly in advance, setup due before kickoff.");
    assert.ok(accepted.body.data.clientAccountProfileId);
    assert.equal(
      accepted.body.data.acceptanceRecord.clientAccountProfileId,
      accepted.body.data.clientAccountProfileId,
    );

    const [convertedDealRows]: any = await pool.execute(
      `SELECT d.pipeline_stage_id as stageId,
              d.stage,
              d.status,
              d.client_account_profile_id as clientAccountProfileId,
              cap.clinic_id as clientClinicId
       FROM deal d
       JOIN client_account_profile cap ON cap.id = d.client_account_profile_id
       WHERE d.id = ?
         AND d.clinic_id = ?`,
      [dealId, primaryClinicId],
    );
    assert.equal(convertedDealRows.length, 1);
    assert.equal(convertedDealRows[0].stageId, wonStageId);
    assert.equal(convertedDealRows[0].stage, "Client Secured", "terminal proposal sync must resolve stages by kind");
    assert.equal(convertedDealRows[0].status, "won");
    assert.equal(convertedDealRows[0].clientAccountProfileId, accepted.body.data.clientAccountProfileId);
    convertedClientClinicId = convertedDealRows[0].clientClinicId;

    const [onboardingTaskRows]: any = await pool.execute(
      `SELECT assigned_user_id as assignedUserId, due_date as dueDate
       FROM task
       WHERE clinic_id = ?
         AND template_key LIKE ?
         AND archived_at IS NULL
         AND deleted_at IS NULL`,
      [primaryClinicId, `won_client_onboarding:${dealId}:%`],
    );
    assert.equal(onboardingTaskRows.length, 16);
    assert.equal(onboardingTaskRows.every((row: any) => row.assignedUserId === writer.id), true);
    assert.equal(onboardingTaskRows.every((row: any) => row.dueDate), true);

    const [movementRows]: any = await pool.execute(
      "SELECT COUNT(*) as count FROM pipeline_deal_movement WHERE clinic_id = ? AND deal_id = ?",
      [primaryClinicId, dealId],
    );
    assert.equal(
      Number(movementRows[0].count),
      2,
      "custom proposal-stage and won-stage transitions should each be recorded once",
    );

    const acceptedRetry = await request(baseUrl, `/api/proposals/${created.body.data.id}/status`, writer.token, {
      method: "POST",
      body: JSON.stringify({
        status: "accepted",
        reason: "Signed acceptance",
        acceptedByName: "Updated Decision Maker",
        acceptedByEmail: "updated-owner@example.com",
        acceptedAt: "2026-07-25T11:30:00.000Z",
        paymentTerms: "Updated payment terms.",
      }),
    });
    assert.equal(acceptedRetry.response.status, 409);
    assert.match(acceptedRetry.body.message, /accepted version is locked/i);

    const acceptedRetryWithoutEvidence = await request(
      baseUrl,
      `/api/proposals/${created.body.data.id}/status`,
      writer.token,
      {
        method: "POST",
        body: JSON.stringify({
          status: "accepted",
          reason: "Acceptance reconfirmed without replacing evidence",
        }),
      },
    );
    assert.equal(acceptedRetryWithoutEvidence.response.status, 409);

    const lockedAcceptedProposal = await request(baseUrl, `/api/proposals/${created.body.data.id}`, writer.token);
    assert.equal(lockedAcceptedProposal.response.status, 200);
    assert.equal(
      lockedAcceptedProposal.body.data.acceptanceRecord.id,
      accepted.body.data.acceptanceRecord.id,
    );
    assert.equal(
      lockedAcceptedProposal.body.data.acceptanceRecord.acceptedByName,
      "Week Two Owner",
    );
    assert.equal(
      lockedAcceptedProposal.body.data.acceptanceRecord.acceptedByEmail,
      "owner@example.com",
    );
    assert.equal(
      lockedAcceptedProposal.body.data.acceptanceRecord.acceptedAt,
      "2026-07-25T10:00:00.000Z",
    );
    assert.equal(
      lockedAcceptedProposal.body.data.acceptanceRecord.paymentTerms,
      "Monthly in advance, setup due before kickoff.",
    );
    const [acceptanceAuditRows]: any = await pool.execute(
      `SELECT entity_id as entityId
       FROM audit_log
       WHERE clinic_id = ?
         AND action = 'PROPOSAL_ACCEPTANCE_RECORD_SAVED'
         AND JSON_UNQUOTE(JSON_EXTRACT(changes, '$.proposalId')) = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [primaryClinicId, created.body.data.id],
    );
    assert.equal(acceptanceAuditRows[0].entityId, accepted.body.data.acceptanceRecord.id);
    const [retryRows]: any = await pool.execute(
      `SELECT
         (SELECT COUNT(*) FROM task
          WHERE clinic_id = ?
            AND template_key LIKE ?
            AND archived_at IS NULL
            AND deleted_at IS NULL) as taskCount,
         (SELECT COUNT(*) FROM pipeline_deal_movement
          WHERE clinic_id = ?
            AND deal_id = ?) as movementCount`,
      [
        primaryClinicId,
        `won_client_onboarding:${dealId}:%`,
        primaryClinicId,
        dealId,
      ],
    );
    assert.equal(Number(retryRows[0].taskCount), 16);
    assert.equal(Number(retryRows[0].movementCount), 2);

    const concurrentProposal = await request(baseUrl, "/api/proposals", writer.token, {
      method: "POST",
      body: JSON.stringify(makeReadyProposalPayload(recommendedPackageId, proofAssetIds, {
        contactId,
        proposalName: "Concurrent terminal proposal",
        status: "ready",
        valueCents: 30000,
        monthlyFeeCents: 30000,
        currency: "GBP",
      })),
    });
    assert.equal(concurrentProposal.response.status, 201);
    const concurrentProposalSent = await request(
      baseUrl,
      `/api/proposals/${concurrentProposal.body.data.id}/send`,
      writer.token,
      {
        method: "POST",
        body: JSON.stringify({
          recipientEmail: "concurrent@example.com",
          recipientName: "Concurrent Decision Maker",
          sendMethod: "manual_email",
        }),
      },
    );
    assert.equal(concurrentProposalSent.response.status, 200);
    assert.equal(concurrentProposalSent.body.data.v5Snapshot.schemaVersion, "proposal_v5");
    await pool.query("DROP TRIGGER IF EXISTS test_proposal_terminal_race");
    await pool.query(
      `CREATE TRIGGER test_proposal_terminal_race
       BEFORE UPDATE ON proposal
       FOR EACH ROW
       SET @proposal_terminal_race_delay =
         IF(OLD.id = '${concurrentProposal.body.data.id}', SLEEP(0.35), 0)`,
    );
    let terminalResults: Awaited<ReturnType<typeof request>>[];
    try {
      terminalResults = await Promise.all([
        request(
          baseUrl,
          `/api/proposals/${concurrentProposal.body.data.id}/status`,
          writer.token,
          {
            method: "POST",
            body: JSON.stringify({
              status: "accepted",
              reason: "Concurrent acceptance",
              acceptedByName: "Concurrent Decision Maker",
              acceptedByEmail: "concurrent@example.com",
            }),
          },
        ),
        request(
          baseUrl,
          `/api/proposals/${concurrentProposal.body.data.id}/status`,
          writer.token,
          {
            method: "POST",
            body: JSON.stringify({
              status: "lost",
              reason: "budget",
              objectionType: "budget",
            }),
          },
        ),
      ]);
    } finally {
      await pool.query("DROP TRIGGER IF EXISTS test_proposal_terminal_race");
    }
    assert.deepEqual(
      terminalResults.map((result) => result.response.status).sort((a, b) => a - b),
      [200, 409],
    );
    const terminalWinner = terminalResults.find((result) => result.response.status === 200);
    const terminalLoser = terminalResults.find((result) => result.response.status === 409);
    assert.ok(terminalWinner);
    assert.ok(terminalLoser);
    assert.match(terminalLoser.body.message, /changed while this update was in progress/i);
    const concurrentRecord = await request(
      baseUrl,
      `/api/proposals/${concurrentProposal.body.data.id}`,
      writer.token,
    );
    assert.equal(concurrentRecord.response.status, 200);
    assert.equal(concurrentRecord.body.data.status, terminalWinner.body.data.status);
    const [concurrentAcceptanceRows]: any = await pool.execute(
      `SELECT COUNT(*) as total
       FROM proposal_acceptance_record
       WHERE clinic_id = ?
         AND proposal_id = ?
         AND deleted_at IS NULL`,
      [primaryClinicId, concurrentProposal.body.data.id],
    );
    assert.equal(
      Number(concurrentAcceptanceRows[0].total),
      terminalWinner.body.data.status === "accepted" ? 1 : 0,
    );

    const sendRaceProposal = await request(baseUrl, "/api/proposals", writer.token, {
      method: "POST",
      body: JSON.stringify(makeReadyProposalPayload(recommendedPackageId, proofAssetIds, {
        contactId,
        proposalName: "Concurrent send proposal",
        status: "ready",
        valueCents: 32000,
        monthlyFeeCents: 32000,
        currency: "GBP",
      })),
    });
    assert.equal(sendRaceProposal.response.status, 201);
    await pool.query("DROP TRIGGER IF EXISTS test_proposal_send_race");
    await pool.query(
      `CREATE TRIGGER test_proposal_send_race
       BEFORE UPDATE ON proposal
       FOR EACH ROW
       SET @proposal_send_race_delay =
         IF(OLD.id = '${sendRaceProposal.body.data.id}', SLEEP(0.75), 0)`,
    );
    let sentDuringRace: Awaited<ReturnType<typeof request>>;
    let staleAcceptanceAfterSend: Awaited<ReturnType<typeof request>>;
    try {
      const sendPromise = request(
        baseUrl,
        `/api/proposals/${sendRaceProposal.body.data.id}/send`,
        writer.token,
        {
          method: "POST",
          body: JSON.stringify({
            recipientEmail: "send-race@example.com",
            recipientName: "Send Race",
            sendMethod: "manual_email",
          }),
        },
      );
      await new Promise((resolve) => setTimeout(resolve, 100));
      [sentDuringRace, staleAcceptanceAfterSend] = await Promise.all([
        sendPromise,
        request(
          baseUrl,
          `/api/proposals/${sendRaceProposal.body.data.id}/status`,
          writer.token,
          {
            method: "POST",
            body: JSON.stringify({
              status: "accepted",
              reason: "Stale concurrent acceptance",
              acceptedByName: "Send Race Signer",
              acceptedByEmail: "send-race@example.com",
            }),
          },
        ),
      ]);
    } finally {
      await pool.query("DROP TRIGGER IF EXISTS test_proposal_send_race");
    }
    assert.equal(sentDuringRace.response.status, 200);
    assert.equal(sentDuringRace.body.data.status, "sent");
    assert.equal(staleAcceptanceAfterSend.response.status, 409);
    assert.match(staleAcceptanceAfterSend.body.message, /sent and frozen/i);

    const archiveRaceProposal = await request(baseUrl, "/api/proposals", writer.token, {
      method: "POST",
      body: JSON.stringify(makeReadyProposalPayload(recommendedPackageId, proofAssetIds, {
        contactId,
        proposalName: "Concurrent archive proposal",
        status: "ready",
        valueCents: 33000,
        monthlyFeeCents: 33000,
        currency: "GBP",
      })),
    });
    assert.equal(archiveRaceProposal.response.status, 201);
    await pool.query("DROP TRIGGER IF EXISTS test_proposal_archive_race");
    await pool.query(
      `CREATE TRIGGER test_proposal_archive_race
       BEFORE UPDATE ON proposal
       FOR EACH ROW
       SET @proposal_archive_race_delay =
         IF(OLD.id = '${archiveRaceProposal.body.data.id}', SLEEP(0.75), 0)`,
    );
    let archivedDuringRace: Awaited<ReturnType<typeof request>>;
    let staleAcceptanceAfterArchive: Awaited<ReturnType<typeof request>>;
    try {
      const archivePromise = request(
        baseUrl,
        `/api/proposals/${archiveRaceProposal.body.data.id}`,
        writer.token,
        { method: "DELETE" },
      );
      await new Promise((resolve) => setTimeout(resolve, 100));
      [archivedDuringRace, staleAcceptanceAfterArchive] = await Promise.all([
        archivePromise,
        request(
          baseUrl,
          `/api/proposals/${archiveRaceProposal.body.data.id}/status`,
          writer.token,
          {
            method: "POST",
            body: JSON.stringify({
              status: "accepted",
              reason: "Stale acceptance after archive",
              acceptedByName: "Archive Race Signer",
              acceptedByEmail: "archive-race@example.com",
            }),
          },
        ),
      ]);
    } finally {
      await pool.query("DROP TRIGGER IF EXISTS test_proposal_archive_race");
    }
    assert.equal(archivedDuringRace.response.status, 200);
    assert.equal(staleAcceptanceAfterArchive.response.status, 409);
    assert.match(staleAcceptanceAfterArchive.body.message, /sent and frozen/i);
    const [archivedRaceRows]: any = await pool.execute(
      `SELECT status,
              deleted_at as deletedAt,
              (
                SELECT COUNT(*)
                FROM proposal_acceptance_record acceptance
                WHERE acceptance.clinic_id = proposal.clinic_id
                  AND acceptance.proposal_id = proposal.id
                  AND acceptance.deleted_at IS NULL
              ) as acceptanceCount
       FROM proposal
       WHERE id = ?
         AND clinic_id = ?`,
      [archiveRaceProposal.body.data.id, primaryClinicId],
    );
    assert.equal(archivedRaceRows[0].status, "archived");
    assert.ok(archivedRaceRows[0].deletedAt);
    assert.equal(Number(archivedRaceRows[0].acceptanceCount), 0);

    await pool.execute(
      `INSERT INTO client_account_profile
        (id, clinic_id, client_status, current_package, created_by, updated_by)
       VALUES (?, ?, 'active', 'Growth Engine', ?, ?)`,
      [localAccountProfileId, primaryClinicId, writer.id, writer.id],
    );
    await pool.execute(
      `UPDATE client_account_profile
       SET growth_score_overall = 42,
           growth_score_website_visibility = 35,
           growth_score_seo = 20,
           growth_score_recommended_package = 'Market Leader',
           growth_score_gap_summary = 'Account-level diagnostic gap summary',
           growth_score_updated_at = '2026-07-26 09:00:00'
       WHERE id = ?`,
      [localAccountProfileId],
    );
    await pool.execute(
      `UPDATE contact
       SET growth_score_overall = NULL,
           growth_score_categories = NULL,
           growth_score_website_visibility = NULL,
           growth_score_seo = 88,
           growth_score_recommended_package = '',
           growth_score_gap_summary = NULL,
           growth_score_updated_at = NULL
       WHERE id = ? AND clinic_id = ?`,
      [contactId, primaryClinicId],
    );
    await pool.execute(
      `INSERT INTO client_account_contact
        (id, clinic_id, client_account_profile_id, contact_id, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [uuidv4(), primaryClinicId, localAccountProfileId, contactId, writer.id],
    );

    const directAcceptedProposal = await request(baseUrl, "/api/proposals", writer.token, {
      method: "POST",
      body: JSON.stringify(makeReadyProposalPayload(recommendedPackageId, proofAssetIds, {
        contactId,
        clientAccountProfileId: localAccountProfileId,
        proposalName: "Direct accepted account proposal",
        status: "ready",
        valueCents: 65000,
        monthlyFeeCents: 65000,
        currency: "GBP",
        paymentTerms: "Direct acceptance terms.",
      })),
    });
    assert.equal(directAcceptedProposal.response.status, 201);
    const directAcceptedSent = await request(
      baseUrl,
      `/api/proposals/${directAcceptedProposal.body.data.id}/send`,
      writer.token,
      {
        method: "POST",
        body: JSON.stringify({
          recipientEmail: "direct-signer@example.com",
          recipientName: "Direct Account Signer",
          sendMethod: "manual_email",
        }),
      },
    );
    assert.equal(directAcceptedSent.response.status, 200);
    assert.equal(directAcceptedSent.body.data.v5Snapshot.schemaVersion, "proposal_v5");
    const directAcceptedStatus = await request(
      baseUrl,
      `/api/proposals/${directAcceptedProposal.body.data.id}/status`,
      writer.token,
      {
        method: "POST",
        body: JSON.stringify({
          status: "accepted",
          reason: "Direct acceptance",
          acceptedByName: "Direct Account Signer",
          acceptedByEmail: "direct-signer@example.com",
          acceptedAt: "2026-07-26T12:00:00.000Z",
          legalCompanyName: "Direct Account Signer Ltd",
          billingEmail: "billing-direct@example.com",
          agreementAccepted: true,
          confirmationText: "Direct Account Signer",
          paymentTerms: "Direct acceptance terms.",
        }),
      },
    );
    assert.equal(directAcceptedStatus.response.status, 200);
    assert.equal(directAcceptedStatus.body.data.status, "accepted");
    assert.equal(
      directAcceptedStatus.body.data.acceptanceRecord.clientAccountProfileId,
      localAccountProfileId,
    );
    assert.equal(
      directAcceptedStatus.body.data.acceptanceRecord.acceptedByEmail,
      "direct-signer@example.com",
    );
    assert.equal(
      directAcceptedStatus.body.data.acceptanceRecord.paymentTerms,
      "Direct acceptance terms.",
    );

    const missingIdentityProposal = await request(baseUrl, "/api/proposals", writer.token, {
      method: "POST",
      body: JSON.stringify(makeReadyProposalPayload(recommendedPackageId, proofAssetIds, {
        contactId,
        clientAccountProfileId: localAccountProfileId,
        proposalName: "Missing first acceptance identity",
        status: "ready",
        valueCents: 45000,
        monthlyFeeCents: 45000,
        currency: "GBP",
      })),
    });
    assert.equal(missingIdentityProposal.response.status, 201);
    const missingIdentitySent = await request(
      baseUrl,
      `/api/proposals/${missingIdentityProposal.body.data.id}/send`,
      writer.token,
      {
        method: "POST",
        body: JSON.stringify({
          recipientEmail: "missing-identity@example.com",
          recipientName: "Missing Identity",
          sendMethod: "manual_email",
        }),
      },
    );
    assert.equal(missingIdentitySent.response.status, 200);
    assert.equal(missingIdentitySent.body.data.v5Snapshot.schemaVersion, "proposal_v5");
    const missingIdentityAcceptance = await request(
      baseUrl,
      `/api/proposals/${missingIdentityProposal.body.data.id}/status`,
      writer.token,
      {
        method: "POST",
        body: JSON.stringify({
          status: "accepted",
          reason: "Missing signer email",
        }),
      },
    );
    assert.equal(missingIdentityAcceptance.response.status, 400);
    assert.match(missingIdentityAcceptance.body.message, /name and email are required/i);
    const missingIdentityAfterFailure = await request(
      baseUrl,
      `/api/proposals/${missingIdentityProposal.body.data.id}`,
      writer.token,
    );
    assert.equal(missingIdentityAfterFailure.body.data.status, "sent");
    assert.equal(missingIdentityAfterFailure.body.data.acceptanceRecord, null);

    const sourceData = await request(
      baseUrl,
      `/api/proposals/source-data?contactId=${encodeURIComponent(contactId)}&clientAccountProfileId=${encodeURIComponent(localAccountProfileId)}`,
      writer.token,
    );
    assert.equal(sourceData.response.status, 200);
    assert.equal(sourceData.body.data.growthScore.overall, 42);
    assert.equal(sourceData.body.data.growthScore.categories.websiteVisibility, 35);
    assert.equal(
      sourceData.body.data.growthScore.categories.seo,
      88,
      "contact diagnostics must still override account diagnostics field by field",
    );
    assert.equal(sourceData.body.data.growthScore.recommendedPackage, "Market Leader");
    assert.equal(sourceData.body.data.growthScore.gapSummary, "Account-level diagnostic gap summary");
    assert.equal(
      sourceData.body.data.growthScore.gaps.some((gap: any) => gap.key === "websiteVisibility"),
      true,
    );
    assert.equal(
      sourceData.body.data.growthScore.gaps.some((gap: any) => gap.key === "seo"),
      false,
    );

    const accountOnlyProposal = await request(baseUrl, "/api/proposals", writer.token, {
      method: "POST",
      body: JSON.stringify({
        clientAccountProfileId: localAccountProfileId,
        proposalName: "Account-only follow-up proposal",
        status: "follow_up_due",
        followUpAt: "2026-08-05T09:00:00.000Z",
        valueCents: 50000,
        currency: "GBP",
      }),
    });
    assert.equal(accountOnlyProposal.response.status, 201);
    assert.equal(accountOnlyProposal.body.data.contactId, null);
    const [accountActivityRows]: any = await pool.execute(
      `SELECT COUNT(*) as total
       FROM activity
       WHERE clinic_id = ?
         AND contact_id = ?
         AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.recordId')) = ?
         AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.action')) = 'proposal_created'`,
      [primaryClinicId, contactId, accountOnlyProposal.body.data.id],
    );
    assert.equal(
      Number(accountActivityRows[0].total),
      1,
      "account-only proposal activity must be visible on a linked record timeline",
    );
    const archivedAccountProposal = await request(
      baseUrl,
      `/api/proposals/${accountOnlyProposal.body.data.id}`,
      writer.token,
      { method: "DELETE" },
    );
    assert.equal(archivedAccountProposal.response.status, 200);
    const [archivedTaskRows]: any = await pool.execute(
      `SELECT status, completed_at as completedAt
       FROM task
       WHERE clinic_id = ?
         AND template_key = ?
         AND deleted_at IS NULL
       LIMIT 1`,
      [primaryClinicId, `proposal_follow_up:${accountOnlyProposal.body.data.id}`],
    );
    assert.equal(archivedTaskRows[0].status, "completed");
    assert.ok(archivedTaskRows[0].completedAt);

    const convertedContactProposal = await request(baseUrl, "/api/proposals", writer.token, {
      method: "POST",
      body: JSON.stringify({
        contactId,
        proposalName: "Converted contact lost proposal",
        status: "draft",
        valueCents: 10000,
        currency: "GBP",
      }),
    });
    assert.equal(convertedContactProposal.response.status, 201);
    const lostConvertedContactProposal = await request(
      baseUrl,
      `/api/proposals/${convertedContactProposal.body.data.id}/status`,
      writer.token,
      {
        method: "POST",
        body: JSON.stringify({
          status: "lost",
          reason: "budget",
          objectionType: "budget",
        }),
      },
    );
    assert.equal(lostConvertedContactProposal.response.status, 200);
    const [convertedContactRows]: any = await pool.execute(
      "SELECT lead_status as leadStatus FROM contact WHERE id = ? AND clinic_id = ?",
      [contactId, primaryClinicId],
    );
    assert.equal(
      convertedContactRows[0].leadStatus,
      "converted",
      "a lost proposal must not demote an already converted contact",
    );

    const rejectedAcceptedResend = await request(
      baseUrl,
      `/api/proposals/${created.body.data.id}/send`,
      writer.token,
      {
        method: "POST",
        body: JSON.stringify({
          recipientEmail: "owner@example.com",
          recipientName: "Week Two Owner",
          sendMethod: "manual_email",
        }),
      },
    );
    assert.equal(rejectedAcceptedResend.response.status, 400);
    assert.match(rejectedAcceptedResend.body.message, /accepted proposal cannot be marked sent/i);

    const rejectedAcceptedFollowUp = await request(
      baseUrl,
      `/api/proposals/${created.body.data.id}/status`,
      writer.token,
      {
        method: "POST",
        body: JSON.stringify({
          status: "follow_up_due",
          followUpAt: "2026-07-29T09:00:00.000Z",
        }),
      },
    );
    assert.equal(rejectedAcceptedFollowUp.response.status, 409);
    assert.match(rejectedAcceptedFollowUp.body.message, /accepted version is locked/i);

    await pool.execute(
      `INSERT INTO pipeline_stage
        (id, clinic_id, pipeline_id, name, color, position, kind, is_locked, created_by)
       VALUES (?, ?, ?, 'Proposal Sent', 'bg-orange-500', 3, 'open', 0, ?)`,
      [proposalSentStageId, primaryClinicId, pipelineId, writer.id],
    );
    const postWinProposal = await request(baseUrl, "/api/proposals", writer.token, {
      method: "POST",
      body: JSON.stringify(makeReadyProposalPayload(recommendedPackageId, proofAssetIds, {
        contactId,
        dealId,
        proposalName: "Post-win add-on proposal",
        status: "ready",
        valueCents: 25000,
        monthlyFeeCents: 25000,
        currency: "GBP",
      })),
    });
    assert.equal(postWinProposal.response.status, 201);
    assert.equal(
      postWinProposal.body.data.clientAccountProfileId,
      null,
      "a proposal created after deal conversion starts without an explicit account link",
    );
    const postWinSent = await request(
      baseUrl,
      `/api/proposals/${postWinProposal.body.data.id}/send`,
      writer.token,
      {
        method: "POST",
        body: JSON.stringify({
          recipientEmail: "owner@example.com",
          recipientName: "Week Two Owner",
          sendMethod: "manual_email",
        }),
      },
    );
    assert.equal(postWinSent.response.status, 200);
    assert.equal(postWinSent.body.data.status, "sent");
    const postWinAccepted = await request(
      baseUrl,
      `/api/proposals/${postWinProposal.body.data.id}/status`,
      writer.token,
      {
        method: "POST",
        body: JSON.stringify({
          status: "accepted",
          reason: "Accepted add-on",
          acceptedByName: "Existing Client Signer",
          acceptedByEmail: "existing-client@example.com",
          paymentTerms: "Add-on payable in advance.",
        }),
      },
    );
    assert.equal(postWinAccepted.response.status, 200);
    assert.equal(postWinAccepted.body.data.status, "accepted");
    assert.equal(
      postWinAccepted.body.data.clientAccountProfileId,
      accepted.body.data.clientAccountProfileId,
    );
    assert.equal(
      postWinAccepted.body.data.acceptanceRecord.clientAccountProfileId,
      accepted.body.data.clientAccountProfileId,
    );

    const [postWinSyncRows]: any = await pool.execute(
      `SELECT
         (SELECT status FROM deal WHERE id = ? AND clinic_id = ?) as dealStatus,
         (SELECT client_account_profile_id FROM deal WHERE id = ? AND clinic_id = ?) as profileId,
         (SELECT COUNT(*) FROM task
          WHERE clinic_id = ?
            AND template_key LIKE ?
            AND archived_at IS NULL
            AND deleted_at IS NULL) as taskCount,
         (SELECT COUNT(*) FROM pipeline_deal_movement
          WHERE clinic_id = ?
            AND deal_id = ?) as movementCount`,
      [
        dealId,
        primaryClinicId,
        dealId,
        primaryClinicId,
        primaryClinicId,
        `won_client_onboarding:${dealId}:%`,
        primaryClinicId,
        dealId,
      ],
    );
    assert.equal(postWinSyncRows[0].dealStatus, "won");
    assert.equal(postWinSyncRows[0].profileId, accepted.body.data.clientAccountProfileId);
    assert.equal(Number(postWinSyncRows[0].taskCount), 16);
    assert.equal(Number(postWinSyncRows[0].movementCount), 2);

    const acceptedPublicPreview = await requestPublic(
      baseUrl,
      `/api/proposals/shared/${encodeURIComponent(publicToken)}`,
    );
    assert.equal(acceptedPublicPreview.response.status, 200, "accepted proposals remain publicly visible");

    await pool.execute(
      "UPDATE proposal SET expires_at = DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 SECOND) WHERE id = ?",
      [created.body.data.id],
    );
    const expiredPublicPreview = await requestPublic(
      baseUrl,
      `/api/proposals/shared/${encodeURIComponent(publicToken)}`,
    );
    assert.equal(expiredPublicPreview.response.status, 404);

    await pool.execute(
      `UPDATE proposal
       SET expires_at = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 1 DAY),
           status = 'lost',
           lost_reason = 'budget',
           objection_type = 'budget'
       WHERE id = ?`,
      [created.body.data.id],
    );
    const lostPublicPreview = await requestPublic(
      baseUrl,
      `/api/proposals/shared/${encodeURIComponent(publicToken)}`,
    );
    assert.equal(lostPublicPreview.response.status, 404);

    const crossTenant = await request(baseUrl, `/api/proposals/${created.body.data.id}`, otherWriter.token);
    assert.equal(crossTenant.response.status, 404);

    const archived = await request(baseUrl, `/api/proposals/${created.body.data.id}`, writer.token, { method: "DELETE" });
    assert.equal(archived.response.status, 200);
    const missing = await request(baseUrl, `/api/proposals/${created.body.data.id}`, writer.token);
    assert.equal(missing.response.status, 404);
  } finally {
    try {
      await closeServer(server);
      await pool.query("DROP TRIGGER IF EXISTS test_proposal_atomic_failure");
      await pool.query("DROP TRIGGER IF EXISTS test_proposal_terminal_race");
      await pool.query("DROP TRIGGER IF EXISTS test_proposal_send_race");
      await pool.query("DROP TRIGGER IF EXISTS test_proposal_archive_race");
      await pool.query("DROP TRIGGER IF EXISTS test_proposal_open_stage_race");
      await pool.execute("DELETE FROM audit_log WHERE clinic_id IN (?, ?)", [primaryClinicId, otherClinicId]);
      await pool.execute("DELETE FROM activity WHERE clinic_id IN (?, ?)", [primaryClinicId, otherClinicId]);
      await pool.execute(
        `DELETE FROM task
         WHERE clinic_id IN (?, ?)
           AND (
             template_key LIKE 'proposal_follow_up:%'
             OR category = 'proposal_follow_up'
             OR template_key LIKE ?
           )`,
        [primaryClinicId, otherClinicId, `won_client_onboarding:${dealId}:%`],
      );
      await pool.execute("DELETE FROM proposal_commercial_event WHERE clinic_id IN (?, ?)", [primaryClinicId, otherClinicId]);
      await pool.execute("DELETE FROM proposal_discovery_answer_source WHERE clinic_id IN (?, ?)", [primaryClinicId, otherClinicId]);
      await pool.execute("DELETE FROM proposal_discovery_session WHERE clinic_id IN (?, ?)", [primaryClinicId, otherClinicId]);
      await pool.execute("DELETE FROM proposal_acceptance_record WHERE clinic_id IN (?, ?)", [primaryClinicId, otherClinicId]);
      await pool.execute("DELETE FROM proposal_render_archive WHERE clinic_id IN (?, ?)", [primaryClinicId, otherClinicId]);
      await pool.execute("DELETE FROM proposal WHERE clinic_id IN (?, ?)", [primaryClinicId, otherClinicId]);
      await pool.execute("DELETE FROM proposal_scope_item WHERE clinic_id IN (?, ?)", [primaryClinicId, otherClinicId]);
      await pool.execute("DELETE FROM proposal_template_version WHERE clinic_id IN (?, ?)", [primaryClinicId, otherClinicId]);
      await pool.execute("DELETE FROM proposal_template WHERE clinic_id IN (?, ?)", [primaryClinicId, otherClinicId]);
      await pool.execute("DELETE FROM contact_document_link WHERE clinic_id = ? AND contact_id = ?", [primaryClinicId, contactId]);
      await pool.execute(
        "DELETE FROM client_account_contact WHERE clinic_id = ? AND contact_id IN (?, ?)",
        [primaryClinicId, contactId, rollbackContactId],
      );
      await pool.execute(
        "DELETE FROM pipeline_deal_movement WHERE clinic_id = ? AND deal_id IN (?, ?)",
        [primaryClinicId, dealId, rollbackDealId],
      );
      await pool.execute("DELETE FROM deal WHERE id IN (?, ?)", [dealId, rollbackDealId]);
      await pool.execute(
        "DELETE FROM pipeline_stage WHERE id IN (?, ?, ?, ?, ?, ?)",
        [
          openStageId,
          customProposalStageId,
          unsafePostTerminalOpenStageId,
          proposalSentStageId,
          wonStageId,
          lostStageId,
        ],
      );
      await pool.execute("DELETE FROM pipeline WHERE id = ?", [pipelineId]);
      await pool.execute("DELETE FROM client_account_profile WHERE id = ?", [localAccountProfileId]);
      await pool.execute("DELETE FROM contact WHERE id IN (?, ?, ?)", [contactId, namelessContactId, rollbackContactId]);
      if (convertedClientClinicId) {
        await pool.execute("DELETE FROM audit_log WHERE clinic_id = ?", [convertedClientClinicId]);
        await pool.execute("DELETE FROM client_account_profile WHERE clinic_id = ?", [convertedClientClinicId]);
        await pool.execute("DELETE FROM clinic WHERE id = ?", [convertedClientClinicId]);
      }
      for (const user of users) {
        await pool.execute("DELETE FROM clinic_membership WHERE user_id = ?", [user.id]);
        await pool.execute("DELETE FROM user WHERE id = ?", [user.id]);
        await pool.execute("DELETE FROM role_permission WHERE role_id = ?", [user.roleId]);
        await pool.execute("DELETE FROM role WHERE id = ?", [user.roleId]);
      }
      await pool.execute("DELETE FROM clinic WHERE id IN (?, ?)", [primaryClinicId, otherClinicId]);
    } finally {
      await pool.end();
    }
  }
});
