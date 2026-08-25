import { body, param, query } from "express-validator";
import { proposalProofAssetTypes, proposalStatuses } from "./proposals.types.js";
import { salesLossReasons, salesObjectionTypes } from "../sales-outcomes/sales-outcomes.constants.js";

const idValidator = (field: string) =>
  body(field)
    .optional({ nullable: true })
    .trim()
    .isLength({ min: 1, max: 36 })
    .withMessage(`${field} must be a valid record identifier`);

const optionalDate = (field: string) =>
  body(field)
    .optional({ nullable: true })
    .isISO8601()
    .withMessage(`${field} must be a valid date/time`);

const proposalClinicTypeVariants = new Set([
  "general",
  "aesthetic_clinic",
  "dental_clinic",
  "cosmetic_surgery_clinic",
  "dermatology_clinic",
  "hair_transplant_clinic",
  "wellness_clinic",
  "private_gp_medical_clinic",
  "medical_spa",
]);

const approvedInternalBrandAssetPrefixes = ["/brand/proposal/", "/brand/proof/"];

const isApprovedInternalBrandAssetPath = (value: string) => {
  const path = value.trim();
  return (
    approvedInternalBrandAssetPrefixes.some((prefix) => path.startsWith(prefix)) &&
    !path.includes("..") &&
    !path.includes("\\") &&
    !/[\r\n<>]/.test(path)
  );
};

const commercialItemsValidator = (field: string) =>
  body(field)
    .optional({ nullable: true })
    .isArray({ max: 30 })
    .withMessage(`${field} must be a list of up to 30 items`)
    .custom((items) => {
      for (const item of items || []) {
        if (!item || typeof item !== "object") throw new Error(`${field} items must be objects`);
        if (typeof item.name !== "string" || item.name.trim().length === 0 || item.name.length > 150) {
          throw new Error(`${field} items require a name up to 150 characters`);
        }
        if (item.amountCents !== null && item.amountCents !== undefined) {
          const amount = Number(item.amountCents);
          if (!Number.isInteger(amount) || amount < 0) throw new Error(`${field} amountCents must be a positive integer`);
        }
        if (item.note !== null && item.note !== undefined && String(item.note).length > 500) {
          throw new Error(`${field} item notes can be up to 500 characters`);
        }
      }
      return true;
    });

const sectionContentValidator = body("sectionContent")
  .optional({ nullable: true })
  .isObject()
  .withMessage("sectionContent must be an object")
  .custom((value) => {
    const allowedKeys = new Set([
      "proposalReference",
      "proposalDate",
      "executiveSummary",
      "clinicTypeVariant",
      "clinicTypeAssetVersion",
      "heroImageUrl",
      "heroImageAlt",
      "heroImageId",
      "heroImageCropPosition",
      "heroImageLicence",
      "discoverySource",
      "customerWording",
      "evidenceConfidenceState",
      "activeConstraintId",
      "activeConstraintConfidenceState",
      "economicUnit",
      "clinicConfirmedContribution",
      "contributionEvidenceSourceDate",
      "contributionConfirmationState",
      "selectedMediaSpend",
      "paybackState",
      "liveDataStatus",
      "knownDataLimitations",
      "sectorImageApprovalStatus",
      "sectorImageProvenance",
      "sectorImages",
      "personalIntroduction",
      "diagnosis",
      "introVideoUrl",
      "introVideoTitle",
      "introVideoThumbnailUrl",
      "fallbackVideoUrl",
      "primaryGoal",
      "clinicTypeAndLocations",
      "currentPosition",
      "currentMarketingSpend",
      "currentWebsiteCrmBookingSetup",
      "problemsDiscussed",
      "whyActNow",
      "currentlyUnmeasured",
      "availableCapacity",
      "priorityTreatments",
      "targetArea",
      "desiredOutcome",
      "growthScoreOverall",
      "visibilityScore",
      "conversionScore",
      "trackingScore",
      "leadHandlingScore",
      "salesConversionScore",
      "retentionScore",
      "biggestRisk",
      "biggestOpportunity",
      "firstRecommendedFix",
      "currentMonthlyEnquiries",
      "currentMonthlyBookedPatients",
      "currentBookingRate",
      "attendanceRate",
      "consultationToTreatmentConversionRate",
      "targetBookings",
      "consultationValue",
      "averageTreatmentValue",
      "availableCommercialCapacity",
      "currentAcquisitionCost",
      "recommendedAdSpend",
      "estimatedCostPerLead",
      "estimatedLeads",
      "estimatedBookedPatients",
      "breakEvenBookings",
      "commercialDataSource",
      "commercialChangeReason",
      "commercialApprovalStatus",
      "recommendedPlan",
      "proofAssetIds",
      "scopeItems",
      "strategyPoints",
      "includedFeatures",
      "successMetrics",
      "clinicGrowerResponsibilities",
      "clientResponsibilities",
      "timeline",
      "termsSummary",
      "investmentNotes",
      "nextSteps",
      "fieldEvidenceReferences",
      "fieldApprovals",
    ]);
    const textKeys = new Set([
      "proposalReference",
      "proposalDate",
      "executiveSummary",
      "clinicTypeVariant",
      "clinicTypeAssetVersion",
      "heroImageAlt",
      "heroImageId",
      "heroImageCropPosition",
      "heroImageLicence",
      "discoverySource",
      "customerWording",
      "evidenceConfidenceState",
      "activeConstraintId",
      "activeConstraintConfidenceState",
      "economicUnit",
      "clinicConfirmedContribution",
      "contributionEvidenceSourceDate",
      "contributionConfirmationState",
      "selectedMediaSpend",
      "paybackState",
      "liveDataStatus",
      "knownDataLimitations",
      "sectorImageApprovalStatus",
      "sectorImageProvenance",
      "personalIntroduction",
      "diagnosis",
      "introVideoTitle",
      "primaryGoal",
      "clinicTypeAndLocations",
      "currentPosition",
      "currentMarketingSpend",
      "currentWebsiteCrmBookingSetup",
      "problemsDiscussed",
      "whyActNow",
      "currentlyUnmeasured",
      "availableCapacity",
      "priorityTreatments",
      "targetArea",
      "desiredOutcome",
      "biggestRisk",
      "biggestOpportunity",
      "firstRecommendedFix",
      "currentMonthlyEnquiries",
      "currentMonthlyBookedPatients",
      "currentBookingRate",
      "attendanceRate",
      "consultationToTreatmentConversionRate",
      "targetBookings",
      "consultationValue",
      "averageTreatmentValue",
      "availableCommercialCapacity",
      "currentAcquisitionCost",
      "recommendedAdSpend",
      "estimatedCostPerLead",
      "estimatedLeads",
      "estimatedBookedPatients",
      "breakEvenBookings",
      "commercialDataSource",
      "commercialChangeReason",
      "commercialApprovalStatus",
      "recommendedPlan",
      "timeline",
      "termsSummary",
      "investmentNotes",
      "nextSteps",
    ]);
    const urlKeys = new Set(["introVideoUrl", "introVideoThumbnailUrl", "fallbackVideoUrl", "heroImageUrl"]);
    const internalBrandImageKeys = new Set(["heroImageUrl", "introVideoThumbnailUrl"]);
    const confidenceStateKeys = new Set([
      "evidenceConfidenceState",
      "activeConstraintConfidenceState",
      "contributionConfirmationState",
      "paybackState",
    ]);
    const scoreKeys = new Set([
      "growthScoreOverall",
      "visibilityScore",
      "conversionScore",
      "trackingScore",
      "leadHandlingScore",
      "salesConversionScore",
      "retentionScore",
    ]);
    const listKeys = new Set([
      "includedFeatures",
      "strategyPoints",
      "successMetrics",
      "clinicGrowerResponsibilities",
      "clientResponsibilities",
    ]);
    const scopeCategories = new Set([
      "Strategy",
      "Google Ads",
      "Meta Ads",
      "SEO",
      "Google Business Profile",
      "Website/Landing Pages",
      "Tracking",
      "Lead Handling",
      "Reporting",
      "Content",
      "Conversion",
      "Retention",
      "Support",
    ]);
    for (const [key, fieldValue] of Object.entries(value || {})) {
      if (!allowedKeys.has(key)) throw new Error(`Unsupported proposal section: ${key}`);
      if (key === "clinicTypeVariant" && fieldValue !== null && fieldValue !== undefined && String(fieldValue).trim()) {
        if (!proposalClinicTypeVariants.has(String(fieldValue).trim())) {
          throw new Error("clinicTypeVariant is not supported");
        }
      }
      if (key === "commercialApprovalStatus" && fieldValue !== null && fieldValue !== undefined && String(fieldValue).trim()) {
        if (!["not_required", "pending", "approved", "rejected"].includes(String(fieldValue).trim())) {
          throw new Error("commercialApprovalStatus is not supported");
        }
      }
      if (confidenceStateKeys.has(key) && fieldValue !== null && fieldValue !== undefined && String(fieldValue).trim()) {
        if (!["known", "confirmed_on_call", "working_diagnosis", "provisional", "to_confirm"].includes(String(fieldValue).trim())) {
          throw new Error(`${key} is not supported`);
        }
      }
      if (key === "liveDataStatus" && fieldValue !== null && fieldValue !== undefined && String(fieldValue).trim()) {
        if (!["demo_data", "partially_connected", "live_connected", "not_connected"].includes(String(fieldValue).trim())) {
          throw new Error("liveDataStatus is not supported");
        }
      }
      if (key === "sectorImageApprovalStatus" && fieldValue !== null && fieldValue !== undefined && String(fieldValue).trim()) {
        if (!["approved", "to_confirm"].includes(String(fieldValue).trim())) {
          throw new Error("sectorImageApprovalStatus is not supported");
        }
      }
      if (textKeys.has(key) && fieldValue !== null && fieldValue !== undefined && String(fieldValue).length > 10000) {
        throw new Error(`${key} is too long`);
      }
      if (urlKeys.has(key) && fieldValue !== null && fieldValue !== undefined) {
        const rawUrl = String(fieldValue).trim();
        if (rawUrl.length > 1000) throw new Error(`${key} is too long`);
        if (rawUrl) {
          if (
            internalBrandImageKeys.has(key) &&
            isApprovedInternalBrandAssetPath(rawUrl)
          ) {
            continue;
          }
          try {
            const parsed = new URL(rawUrl);
            if (!["https:", "http:"].includes(parsed.protocol)) throw new Error("invalid protocol");
          } catch {
            throw new Error(`${key} must be a valid URL`);
          }
        }
      }
      if (scoreKeys.has(key) && fieldValue !== null && fieldValue !== undefined) {
        const score = Number(fieldValue);
        if (!Number.isFinite(score) || score < 0 || score > 100) throw new Error(`${key} must be a score from 0 to 100`);
      }
      if (listKeys.has(key)) {
        if (!Array.isArray(fieldValue)) throw new Error(`${key} must be a list`);
        if (fieldValue.length > 40) throw new Error(`${key} can include up to 40 items`);
        for (const item of fieldValue) {
          if (String(item).length > 500) throw new Error(`${key} items can be up to 500 characters`);
        }
      }
      if (key === "proofAssetIds") {
        if (!Array.isArray(fieldValue)) throw new Error("proofAssetIds must be a list");
        if (fieldValue.length > 20) throw new Error("proofAssetIds can include up to 20 records");
        for (const item of fieldValue) {
          if (typeof item !== "string" || item.trim().length === 0 || item.length > 36) {
            throw new Error("proofAssetIds entries must be valid record identifiers");
          }
        }
      }
      if (key === "fieldEvidenceReferences") {
        if (fieldValue === null || fieldValue === undefined) continue;
        if (!fieldValue || typeof fieldValue !== "object" || Array.isArray(fieldValue)) {
          throw new Error("fieldEvidenceReferences must be an object");
        }
        const entries = Object.entries(fieldValue as Record<string, unknown>);
        if (entries.length > 80) throw new Error("fieldEvidenceReferences can include up to 80 fields");
        for (const [fieldName, reference] of entries) {
          if (!/^[A-Za-z0-9_.:-]{1,120}$/.test(fieldName)) {
            throw new Error("fieldEvidenceReferences keys must be stable field names");
          }
          if (reference !== null && reference !== undefined && String(reference).length > 500) {
            throw new Error("fieldEvidenceReferences values can be up to 500 characters");
          }
        }
      }
      if (key === "fieldApprovals") {
        if (fieldValue === null || fieldValue === undefined) continue;
        if (!fieldValue || typeof fieldValue !== "object" || Array.isArray(fieldValue)) {
          throw new Error("fieldApprovals must be an object");
        }
        const entries = Object.entries(fieldValue as Record<string, unknown>);
        if (entries.length > 80) throw new Error("fieldApprovals can include up to 80 fields");
        for (const [fieldName, approval] of entries) {
          if (!/^[A-Za-z0-9_.:-]{1,120}$/.test(fieldName)) {
            throw new Error("fieldApprovals keys must be stable field names");
          }
          if (approval === null || approval === undefined) continue;
          if (typeof approval !== "object" || Array.isArray(approval)) {
            throw new Error("fieldApprovals entries must be objects");
          }
          const approvalRecord = approval as Record<string, unknown>;
          const allowedApprovalKeys = new Set(["evidenceReference", "approvedBy", "approvedAt", "approvalStatus"]);
          for (const approvalKey of Object.keys(approvalRecord)) {
            if (!allowedApprovalKeys.has(approvalKey)) throw new Error(`Unsupported fieldApprovals field: ${approvalKey}`);
          }
          for (const approvalTextKey of ["evidenceReference", "approvedBy"]) {
            if (approvalRecord[approvalTextKey] !== null && approvalRecord[approvalTextKey] !== undefined && String(approvalRecord[approvalTextKey]).length > 500) {
              throw new Error(`fieldApprovals ${approvalTextKey} can be up to 500 characters`);
            }
          }
          if (approvalRecord.approvedAt !== null && approvalRecord.approvedAt !== undefined && String(approvalRecord.approvedAt).trim()) {
            const parsed = Date.parse(String(approvalRecord.approvedAt));
            if (!Number.isFinite(parsed)) throw new Error("fieldApprovals approvedAt must be a valid date/time");
          }
          if (approvalRecord.approvalStatus !== null && approvalRecord.approvalStatus !== undefined && String(approvalRecord.approvalStatus).trim()) {
            if (!["not_required", "pending", "approved", "rejected"].includes(String(approvalRecord.approvalStatus).trim())) {
              throw new Error("fieldApprovals approvalStatus is not supported");
            }
          }
        }
      }
      if (key === "scopeItems") {
        if (!Array.isArray(fieldValue)) throw new Error("scopeItems must be a list");
        if (fieldValue.length > 60) throw new Error("scopeItems can include up to 60 items");
        for (const item of fieldValue) {
          if (!item || typeof item !== "object") throw new Error("scopeItems entries must be objects");
          const scopeItem = item as Record<string, unknown>;
          if (!scopeCategories.has(String(scopeItem.category || ""))) throw new Error("scopeItems category is not supported");
          if (!String(scopeItem.title || "").trim() || String(scopeItem.title || "").length > 180) {
            throw new Error("scopeItems title is required and can be up to 180 characters");
          }
          if (!String(scopeItem.clientDescription || "").trim() || String(scopeItem.clientDescription || "").length > 2000) {
            throw new Error("scopeItems clientDescription is required and can be up to 2000 characters");
          }
          if (scopeItem.frequency !== null && scopeItem.frequency !== undefined && String(scopeItem.frequency).length > 120) {
            throw new Error("scopeItems frequency can be up to 120 characters");
          }
          if (scopeItem.quantityLimit !== null && scopeItem.quantityLimit !== undefined && String(scopeItem.quantityLimit).length > 120) {
            throw new Error("scopeItems quantityLimit can be up to 120 characters");
          }
          for (const field of [
            "treatmentsAndLocations",
            "dependencies",
            "clientResponsibilities",
            "exclusions",
            "thirdPartyCosts",
            "changeReason",
          ]) {
            if (scopeItem[field] !== null && scopeItem[field] !== undefined && String(scopeItem[field]).length > 2000) {
              throw new Error(`scopeItems ${field} can be up to 2000 characters`);
            }
          }
          if (!["included", "excluded"].includes(String(scopeItem.inclusionStatus || ""))) {
            throw new Error("scopeItems inclusionStatus must be included or excluded");
          }
          if (!["recurring", "one_off"].includes(String(scopeItem.deliveryType || ""))) {
            throw new Error("scopeItems deliveryType must be recurring or one_off");
          }
          if (typeof scopeItem.isOptionalAddOn !== "boolean") throw new Error("scopeItems isOptionalAddOn must be true or false");
          if (scopeItem.isCustom !== undefined && typeof scopeItem.isCustom !== "boolean") {
            throw new Error("scopeItems isCustom must be true or false");
          }
          if (scopeItem.approvalStatus !== null && scopeItem.approvalStatus !== undefined) {
            if (!["not_required", "pending", "approved", "rejected"].includes(String(scopeItem.approvalStatus))) {
              throw new Error("scopeItems approvalStatus is not supported");
            }
          }
          if (!Number.isInteger(Number(scopeItem.sortOrder))) throw new Error("scopeItems sortOrder must be an integer");
        }
      }
      if (key === "sectorImages") {
        if (!Array.isArray(fieldValue)) throw new Error("sectorImages must be a list");
        if (fieldValue.length > 4) throw new Error("sectorImages can include up to four image slots");
        const seenSlots = new Set<string>();
        for (const item of fieldValue) {
          if (!item || typeof item !== "object") throw new Error("sectorImages entries must be objects");
          const image = item as Record<string, unknown>;
          const slot = String(image.slot || "");
          if (!["cover", "journey", "proof", "close"].includes(slot)) {
            throw new Error("sectorImages slot must be cover, journey, proof or close");
          }
          if (seenSlots.has(slot)) throw new Error("sectorImages slots must be unique");
          seenSlots.add(slot);
          for (const field of ["imageId", "cropPosition", "licence", "provenance"]) {
            if (image[field] !== null && image[field] !== undefined && String(image[field]).length > 500) {
              throw new Error(`sectorImages ${field} can be up to 500 characters`);
            }
          }
          if (image.url !== null && image.url !== undefined) {
            const rawUrl = String(image.url).trim();
            if (rawUrl.length > 1000) throw new Error("sectorImages url is too long");
            if (rawUrl) {
              if (isApprovedInternalBrandAssetPath(rawUrl)) {
                continue;
              }
              try {
                const parsed = new URL(rawUrl);
                if (!["https:", "http:"].includes(parsed.protocol)) throw new Error("invalid protocol");
              } catch {
                throw new Error("sectorImages url must be a valid URL");
              }
            }
          }
          if (image.approvalStatus !== null && image.approvalStatus !== undefined) {
            if (!["approved", "to_confirm"].includes(String(image.approvalStatus))) {
              throw new Error("sectorImages approvalStatus is not supported");
            }
          }
        }
      }
    }
    return true;
  });

function hasLinkedRecord(value: Record<string, unknown>) {
  return Boolean(value.contactId || value.dealId || value.clientAccountProfileId);
}

export const proposalIdParamValidator = [
  param("id").trim().isLength({ min: 1, max: 36 }).withMessage("Proposal ID is required"),
];

export const proposalPublicTokenParamValidator = [
  param("token").trim().isLength({ min: 20, max: 200 }).withMessage("Proposal link is invalid"),
];

export const proposalPublicAcceptanceValidator = [
  ...proposalPublicTokenParamValidator,
  body("fullName").trim().notEmpty().withMessage("Full name is required").isLength({ max: 255 }),
  body("email").trim().isEmail().withMessage("A valid email is required").isLength({ max: 255 }),
  body("legalCompanyName").trim().notEmpty().withMessage("Legal company name is required").isLength({ max: 255 }),
  body("billingEmail").trim().isEmail().withMessage("A valid billing email is required").isLength({ max: 255 }),
  body("preferredStartDate").optional({ nullable: true }).isISO8601().withMessage("Preferred start date must be a valid date"),
  body("agreementAccepted").custom((value) => value === true).withMessage("Agreement must be accepted"),
  body("signatureConfirmation")
    .trim()
    .notEmpty()
    .withMessage("Signature confirmation is required")
    .isLength({ max: 255 }),
];

export const proposalPublicEventValidator = [
  ...proposalPublicTokenParamValidator,
  body("eventType")
    .trim()
    .isIn([
      "section_viewed",
      "video_opened",
      "pdf_download_clicked",
      "acceptance_cta_clicked",
      "question_clicked",
      "book_call_clicked",
    ])
    .withMessage("Proposal event type is not supported"),
  body("sectionKey").optional({ nullable: true }).trim().isLength({ max: 120 }),
];

const proposalListValidators = (maximumLimit: number) => [
  query("contactId").optional().trim().isLength({ min: 1, max: 36 }),
  query("dealId").optional().trim().isLength({ min: 1, max: 36 }),
  query("clientAccountProfileId").optional().trim().isLength({ min: 1, max: 36 }),
  query("ownerId").optional().trim().isLength({ min: 1, max: 36 }),
  query("status").optional().isIn(["all", ...proposalStatuses]),
  query("followUpDue").optional().isBoolean(),
  query("includeArchived").optional().isBoolean(),
  query("search").optional().trim().isLength({ max: 255 }),
  query("limit").optional().isInt({ min: 1, max: maximumLimit }).toInt(),
];

export const listProposalsValidator = proposalListValidators(250);
export const exportProposalsValidator = proposalListValidators(5000);

export const listProposalRenderArchiveValidator = [
  query("proposalId").optional().trim().isLength({ min: 1, max: 36 }),
  query("clientAccountProfileId").optional().trim().isLength({ min: 1, max: 36 }),
  query("search").optional().trim().isLength({ max: 255 }),
  query("limit").optional().isInt({ min: 1, max: 250 }).toInt(),
];

export const proposalSourceDataValidator = [
  query("contactId").optional().trim().isLength({ min: 1, max: 36 }),
  query("dealId").optional().trim().isLength({ min: 1, max: 36 }),
  query("clientAccountProfileId").optional().trim().isLength({ min: 1, max: 36 }),
  query().custom((value) => {
    if (!value.contactId && !value.dealId && !value.clientAccountProfileId) {
      throw new Error("Provide a contact, deal or client account to pull proposal data");
    }
    return true;
  }),
];

export const createProposalValidator = [
  body().custom(hasLinkedRecord).withMessage("Proposal must link to a lead/contact, deal, or client account"),
  idValidator("contactId"),
  idValidator("dealId"),
  idValidator("clientAccountProfileId"),
  body("proposalName").trim().notEmpty().withMessage("Proposal name is required").isLength({ max: 255 }),
  body("templateKey").optional({ nullable: true }).trim().isLength({ min: 1, max: 100 }),
  idValidator("templateId"),
  idValidator("templateVersionId"),
  body("packageName").optional({ nullable: true }).trim().isLength({ max: 150 }),
  idValidator("recommendedPackageId"),
  idValidator("ownerId"),
  body("status").optional().isIn(proposalStatuses),
  body("valueCents").optional({ nullable: true }).isInt({ min: 0 }),
  body("monthlyFeeCents").optional({ nullable: true }).isInt({ min: 0 }),
  body("setupFeeCents").optional({ nullable: true }).isInt({ min: 0 }),
  body("currency").optional({ nullable: true }).trim().isLength({ min: 3, max: 3 }),
  body("adSpendNote").optional({ nullable: true }).trim().isLength({ max: 2000 }),
  body("vatStatus").optional({ nullable: true }).trim().isLength({ max: 50 }),
  body("minimumTermMonths").optional({ nullable: true }).isInt({ min: 0, max: 120 }),
  body("noticePeriodDays").optional({ nullable: true }).isInt({ min: 0, max: 365 }),
  optionalDate("startDate"),
  optionalDate("followUpAt"),
  optionalDate("readyAt"),
  optionalDate("sentAt"),
  optionalDate("viewedAt"),
  optionalDate("acceptedAt"),
  body("acceptedReason").optional({ nullable: true }).trim().isLength({ max: 255 }),
  body("acceptedByName").optional({ nullable: true }).trim().isLength({ max: 255 }),
  body("acceptedByEmail").optional({ nullable: true }).trim().isEmail().withMessage("Accepted by email must be valid"),
  body("paymentTerms").optional({ nullable: true }).trim().isLength({ max: 2000 }),
  optionalDate("wonAt"),
  body("wonReason").optional({ nullable: true }).trim().isLength({ max: 255 }),
  optionalDate("lostAt"),
  body("lostReason").optional({ nullable: true }).isIn(salesLossReasons),
  body("objectionType").optional({ nullable: true }).isIn(salesObjectionTypes),
  optionalDate("expiresAt"),
  body("proposalUrl").optional({ nullable: true }).trim().isLength({ max: 500 }),
  body("notes").optional({ nullable: true }).trim().isLength({ max: 10000 }),
  commercialItemsValidator("addOns"),
  commercialItemsValidator("discounts"),
  body("internalMarginNote").optional({ nullable: true }).trim().isLength({ max: 5000 }),
  sectionContentValidator,
];

export const updateProposalValidator = [
  ...proposalIdParamValidator,
  idValidator("contactId"),
  idValidator("dealId"),
  idValidator("clientAccountProfileId"),
  body("proposalName").optional().trim().notEmpty().isLength({ max: 255 }),
  body("templateKey").optional({ nullable: true }).trim().isLength({ min: 1, max: 100 }),
  idValidator("templateId"),
  idValidator("templateVersionId"),
  body("packageName").optional({ nullable: true }).trim().isLength({ max: 150 }),
  idValidator("recommendedPackageId"),
  idValidator("ownerId"),
  body("status").optional().isIn(proposalStatuses),
  body("valueCents").optional({ nullable: true }).isInt({ min: 0 }),
  body("monthlyFeeCents").optional({ nullable: true }).isInt({ min: 0 }),
  body("setupFeeCents").optional({ nullable: true }).isInt({ min: 0 }),
  body("currency").optional({ nullable: true }).trim().isLength({ min: 3, max: 3 }),
  body("adSpendNote").optional({ nullable: true }).trim().isLength({ max: 2000 }),
  body("vatStatus").optional({ nullable: true }).trim().isLength({ max: 50 }),
  body("minimumTermMonths").optional({ nullable: true }).isInt({ min: 0, max: 120 }),
  body("noticePeriodDays").optional({ nullable: true }).isInt({ min: 0, max: 365 }),
  optionalDate("startDate"),
  optionalDate("followUpAt"),
  optionalDate("readyAt"),
  optionalDate("sentAt"),
  optionalDate("viewedAt"),
  optionalDate("acceptedAt"),
  body("acceptedReason").optional({ nullable: true }).trim().isLength({ max: 255 }),
  body("acceptedByName").optional({ nullable: true }).trim().isLength({ max: 255 }),
  body("acceptedByEmail").optional({ nullable: true }).trim().isEmail().withMessage("Accepted by email must be valid"),
  body("paymentTerms").optional({ nullable: true }).trim().isLength({ max: 2000 }),
  optionalDate("wonAt"),
  body("wonReason").optional({ nullable: true }).trim().isLength({ max: 255 }),
  optionalDate("lostAt"),
  body("lostReason").optional({ nullable: true }).isIn(salesLossReasons),
  body("objectionType").optional({ nullable: true }).isIn(salesObjectionTypes),
  optionalDate("expiresAt"),
  body("proposalUrl").optional({ nullable: true }).trim().isLength({ max: 500 }),
  body("notes").optional({ nullable: true }).trim().isLength({ max: 10000 }),
  commercialItemsValidator("addOns"),
  commercialItemsValidator("discounts"),
  body("internalMarginNote").optional({ nullable: true }).trim().isLength({ max: 5000 }),
  sectionContentValidator,
];

export const createProofAssetValidator = [
  body("type").isIn(proposalProofAssetTypes).withMessage("Proof asset type is not supported"),
  body("title").trim().notEmpty().withMessage("Proof title is required").isLength({ max: 180 }),
  body("copy").trim().notEmpty().withMessage("Proof copy is required").isLength({ max: 5000 }),
  body("mediaUrl")
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 1000 })
    .custom((value) => {
      if (!value) return true;
      if (isApprovedInternalBrandAssetPath(value)) return true;
      try {
        const parsed = new URL(value);
        if (!["https:", "http:"].includes(parsed.protocol)) throw new Error("invalid protocol");
      } catch {
        throw new Error("mediaUrl must be a valid URL");
      }
      return true;
    }),
  body("sectorTags")
    .optional({ nullable: true })
    .isArray({ max: 20 })
    .withMessage("sectorTags must be a list of up to 20 tags")
    .custom((tags) => {
      for (const tag of tags || []) {
        if (typeof tag !== "string" || !tag.trim() || tag.length > 80) {
          throw new Error("sectorTags must contain non-empty tags up to 80 characters");
        }
      }
      return true;
    }),
  body("sortOrder").optional({ nullable: true }).isInt({ min: 0, max: 100000 }).toInt(),
  body("isActive").optional({ nullable: true }).isBoolean(),
];

export const listProofAssetsValidator = [
  query("includeInactive").optional({ nullable: true }).isBoolean().toBoolean(),
  query("search").optional({ nullable: true }).trim().isLength({ max: 200 }),
  query("type").optional({ nullable: true }).isIn([...proposalProofAssetTypes, "all"]),
  query("status").optional({ nullable: true }).isIn(["active", "archived", "all"]),
  query("tag").optional({ nullable: true }).trim().isLength({ max: 120 }),
  query("page").optional({ nullable: true }).isInt({ min: 1, max: 10000 }).toInt(),
  query("limit").optional({ nullable: true }).isInt({ min: 1, max: 100 }).toInt(),
];

export const updateProofAssetValidator = [
  param("proofAssetId").trim().isLength({ min: 1, max: 36 }),
  body("type").optional({ nullable: true }).isIn(proposalProofAssetTypes).withMessage("Proof asset type is not supported"),
  body("title").optional({ nullable: true }).trim().isLength({ min: 1, max: 180 }),
  body("copy").optional({ nullable: true }).trim().isLength({ min: 1, max: 5000 }),
  body("mediaUrl")
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 1000 })
    .custom((value) => {
      if (!value) return true;
      if (isApprovedInternalBrandAssetPath(value)) return true;
      try {
        const parsed = new URL(value);
        if (!["https:", "http:"].includes(parsed.protocol)) throw new Error("invalid protocol");
      } catch {
        throw new Error("mediaUrl must be a valid URL");
      }
      return true;
    }),
  body("sectorTags")
    .optional({ nullable: true })
    .isArray({ max: 20 })
    .withMessage("sectorTags must be a list of up to 20 tags")
    .custom((tags) => {
      for (const tag of tags || []) {
        if (typeof tag !== "string" || !tag.trim() || tag.length > 80) {
          throw new Error("sectorTags must contain non-empty tags up to 80 characters");
        }
      }
      return true;
    }),
  body("sortOrder").optional({ nullable: true }).isInt({ min: 0, max: 100000 }).toInt(),
  body("isActive").optional({ nullable: true }).isBoolean(),
];

export const proofAssetIdParamValidator = [
  param("proofAssetId").trim().isLength({ min: 1, max: 36 }),
];

const scopeLibraryDeliverablesValidator = body("deliverables")
  .optional({ nullable: true })
  .isArray({ max: 30 })
  .withMessage("deliverables must be a list of up to 30 rows")
  .custom((rows) => {
    for (const row of rows || []) {
      if (typeof row !== "string" || !row.trim() || row.length > 300) {
        throw new Error("deliverables must contain non-empty rows up to 300 characters");
      }
    }
    return true;
  });

export const listProposalScopeLibraryValidator = [
  query("search").optional({ nullable: true }).trim().isLength({ max: 200 }),
  query("category").optional({ nullable: true }).trim().isLength({ max: 80 }),
  query("status").optional({ nullable: true }).isIn(["active", "archived", "all"]),
  query("templateKey").optional({ nullable: true }).trim().isLength({ max: 100 }),
  query("page").optional({ nullable: true }).isInt({ min: 1, max: 10000 }).toInt(),
  query("limit").optional({ nullable: true }).isInt({ min: 1, max: 100 }).toInt(),
];

export const createProposalScopeLibraryItemValidator = [
  body("templateKey").optional({ nullable: true }).trim().isLength({ min: 1, max: 100 }),
  body("name").trim().notEmpty().withMessage("Scope item name is required").isLength({ max: 180 }),
  body("category").trim().notEmpty().withMessage("Scope item category is required").isLength({ max: 80 }),
  body("description").optional({ nullable: true }).trim().isLength({ max: 2000 }),
  body("clientDescription").optional({ nullable: true }).trim().isLength({ max: 2000 }),
  scopeLibraryDeliverablesValidator,
  body("frequency").optional({ nullable: true }).trim().isLength({ max: 120 }),
  body("quantityLimit").optional({ nullable: true }).trim().isLength({ max: 120 }),
  body("treatmentsAndLocations").optional({ nullable: true }).trim().isLength({ max: 2000 }),
  body("dependencies").optional({ nullable: true }).trim().isLength({ max: 2000 }),
  body("clientResponsibilities").optional({ nullable: true }).trim().isLength({ max: 2000 }),
  body("exclusions").optional({ nullable: true }).trim().isLength({ max: 2000 }),
  body("thirdPartyCosts").optional({ nullable: true }).trim().isLength({ max: 2000 }),
  body("inclusionStatus").optional({ nullable: true }).isIn(["included", "excluded"]),
  body("deliveryType").optional({ nullable: true }).isIn(["recurring", "one_off"]),
  body("isOptionalAddOn").optional({ nullable: true }).isBoolean(),
  body("sortOrder").optional({ nullable: true }).isInt({ min: 0, max: 100000 }).toInt(),
];

export const updateProposalScopeLibraryItemValidator = [
  param("scopeItemId").trim().isLength({ min: 1, max: 36 }),
  body("templateKey").optional({ nullable: true }).trim().isLength({ min: 1, max: 100 }),
  body("name").optional({ nullable: true }).trim().isLength({ min: 1, max: 180 }),
  body("category").optional({ nullable: true }).trim().isLength({ min: 1, max: 80 }),
  body("description").optional({ nullable: true }).trim().isLength({ max: 2000 }),
  body("clientDescription").optional({ nullable: true }).trim().isLength({ max: 2000 }),
  scopeLibraryDeliverablesValidator,
  body("frequency").optional({ nullable: true }).trim().isLength({ max: 120 }),
  body("quantityLimit").optional({ nullable: true }).trim().isLength({ max: 120 }),
  body("treatmentsAndLocations").optional({ nullable: true }).trim().isLength({ max: 2000 }),
  body("dependencies").optional({ nullable: true }).trim().isLength({ max: 2000 }),
  body("clientResponsibilities").optional({ nullable: true }).trim().isLength({ max: 2000 }),
  body("exclusions").optional({ nullable: true }).trim().isLength({ max: 2000 }),
  body("thirdPartyCosts").optional({ nullable: true }).trim().isLength({ max: 2000 }),
  body("inclusionStatus").optional({ nullable: true }).isIn(["included", "excluded"]),
  body("deliveryType").optional({ nullable: true }).isIn(["recurring", "one_off"]),
  body("isOptionalAddOn").optional({ nullable: true }).isBoolean(),
  body("sortOrder").optional({ nullable: true }).isInt({ min: 0, max: 100000 }).toInt(),
];

export const proposalScopeLibraryItemIdParamValidator = [
  param("scopeItemId").trim().isLength({ min: 1, max: 36 }),
];

export const proposalTemplateIdParamValidator = [
  param("templateId").trim().isLength({ min: 1, max: 36 }),
];

export const proposalTemplateVersionIdParamValidator = [
  ...proposalTemplateIdParamValidator,
  param("versionId").trim().isLength({ min: 1, max: 36 }),
];

const templateContentValidator = body("content")
  .optional({ nullable: true })
  .isObject()
  .withMessage("content must be an object")
  .custom((content) => {
    if (!content) return true;
    const allowedTopLevel = new Set([
      "name",
      "description",
      "packageName",
      "defaultSections",
      "defaultRoadmap",
      "defaultTerms",
      "defaultSuccessMetrics",
      "editablePolicyVersion",
      "lockedFields",
    ]);
    for (const key of Object.keys(content)) {
      if (!allowedTopLevel.has(key)) throw new Error(`Unsupported template content field: ${key}`);
    }
    if (content.name !== undefined && content.name !== null && String(content.name).trim().length > 150) {
      throw new Error("Template name can be up to 150 characters");
    }
    if (content.description !== undefined && content.description !== null && String(content.description).trim().length > 2000) {
      throw new Error("Template description can be up to 2000 characters");
    }
    for (const listKey of ["defaultRoadmap", "defaultSuccessMetrics", "lockedFields"]) {
      if (content[listKey] !== undefined && content[listKey] !== null) {
        if (!Array.isArray(content[listKey]) || content[listKey].length > 80) {
          throw new Error(`${listKey} must be a list of up to 80 items`);
        }
      }
    }
    return true;
  });

export const createProposalTemplateValidator = [
  body("templateKey").optional({ nullable: true }).trim().isLength({ min: 1, max: 100 }),
  body("name").optional({ nullable: true }).trim().isLength({ min: 1, max: 150 }),
  body("description").optional({ nullable: true }).trim().isLength({ max: 2000 }),
  body("changeSummary").optional({ nullable: true }).trim().isLength({ max: 1000 }),
  templateContentValidator,
];

export const createProposalTemplateVersionValidator = [
  ...proposalTemplateIdParamValidator,
  body("expectedContentHash").optional({ nullable: true }).trim().isLength({ min: 64, max: 64 }),
  body("changeSummary").optional({ nullable: true }).trim().isLength({ max: 1000 }),
  templateContentValidator,
];

export const updateProposalTemplateVersionValidator = [
  ...proposalTemplateVersionIdParamValidator,
  body("expectedContentHash").optional({ nullable: true }).trim().isLength({ min: 64, max: 64 }),
  body("changeSummary").optional({ nullable: true }).trim().isLength({ max: 1000 }),
  templateContentValidator,
];

export const rejectProposalTemplateVersionValidator = [
  ...proposalTemplateVersionIdParamValidator,
  body("reason").trim().notEmpty().withMessage("Rejection reason is required").isLength({ max: 2000 }),
];

export const rollbackProposalTemplateValidator = [
  ...proposalTemplateIdParamValidator,
  body("sourceVersionId").trim().isLength({ min: 1, max: 36 }),
  body("reason").optional({ nullable: true }).trim().isLength({ max: 2000 }),
];

export const compareProposalTemplateVersionValidator = [
  ...proposalTemplateIdParamValidator,
  query("fromVersionId").trim().isLength({ min: 1, max: 36 }),
  query("toVersionId").trim().isLength({ min: 1, max: 36 }),
];

export const sendProposalValidator = [
  ...proposalIdParamValidator,
  body("recipientEmail").optional({ nullable: true }).trim().isEmail().withMessage("Recipient email must be valid"),
  body("recipientName").optional({ nullable: true }).trim().isLength({ max: 255 }),
  body("sendMethod").optional({ nullable: true }).trim().isLength({ min: 1, max: 50 }),
  body("sendNote").optional({ nullable: true }).trim().isLength({ max: 2000 }),
];

export const proposalStatusUpdateValidator = [
  ...proposalIdParamValidator,
  body("status").isIn(["follow_up_due", "accepted", "won", "lost"]),
  optionalDate("followUpAt"),
  body("reason")
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 255 })
    .custom((value, { req }) => {
      if (req.body?.status === "lost" && !salesLossReasons.includes(value)) {
        throw new Error("Lost reason must be one of the supported options");
      }
      return true;
    }),
  body("objectionType").optional({ nullable: true }).isIn(salesObjectionTypes),
  body("acceptedByName").optional({ nullable: true }).trim().isLength({ max: 255 }),
  body("acceptedByEmail").optional({ nullable: true }).trim().isEmail().withMessage("Accepted by email must be valid"),
  optionalDate("acceptedAt"),
  body("paymentTerms").optional({ nullable: true }).trim().isLength({ max: 2000 }),
];

export const createProposalSignatureRequestValidator = [
  ...proposalIdParamValidator,
  body("signerName").optional({ nullable: true }).trim().isLength({ min: 1, max: 255 }),
  body("signerEmail").optional({ nullable: true }).trim().isEmail().withMessage("Signer email must be valid"),
  body("idempotencyKey").optional({ nullable: true }).trim().isLength({ min: 8, max: 191 }),
];

export const proposalSignatureWebhookProviderValidator = [
  param("provider").trim().isIn(["log", "pandadoc", "docusign"]).withMessage("Unsupported e-sign provider"),
  body("providerRequestId").trim().notEmpty().isLength({ max: 191 }),
  body("providerEventId").optional({ nullable: true }).trim().isLength({ min: 1, max: 191 }),
  body("eventType").optional({ nullable: true }).trim().isLength({ min: 1, max: 100 }),
  body("status").optional({ nullable: true }).trim().isLength({ min: 1, max: 50 }),
  body("signerName").optional({ nullable: true }).trim().isLength({ min: 1, max: 255 }),
  body("signerEmail").optional({ nullable: true }).trim().isEmail().withMessage("Signer email must be valid"),
  body("signedAt").optional({ nullable: true }).isISO8601(),
  body("signedPdfUrl").optional({ nullable: true }).trim().isURL({ require_protocol: true }).isLength({ max: 1000 }),
  body("auditCertificateUrl").optional({ nullable: true }).trim().isURL({ require_protocol: true }).isLength({ max: 1000 }),
  body("evidenceSha256").optional({ nullable: true }).trim().isHexadecimal().isLength({ min: 64, max: 64 }),
  body("evidence").optional({ nullable: true }).isObject(),
];
