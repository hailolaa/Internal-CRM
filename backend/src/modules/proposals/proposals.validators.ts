import { body, param, query } from "express-validator";
import { proposalStatuses } from "./proposals.types.js";
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
      "executiveSummary",
      "personalIntroduction",
      "diagnosis",
      "introVideoUrl",
      "introVideoTitle",
      "fallbackVideoUrl",
      "primaryGoal",
      "currentPosition",
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
      "targetBookings",
      "consultationValue",
      "averageTreatmentValue",
      "availableCommercialCapacity",
      "recommendedAdSpend",
      "estimatedCostPerLead",
      "estimatedLeads",
      "estimatedBookedPatients",
      "breakEvenBookings",
      "commercialDataSource",
      "recommendedPlan",
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
    ]);
    const textKeys = new Set([
      "executiveSummary",
      "personalIntroduction",
      "diagnosis",
      "introVideoTitle",
      "primaryGoal",
      "currentPosition",
      "availableCapacity",
      "priorityTreatments",
      "targetArea",
      "desiredOutcome",
      "biggestRisk",
      "biggestOpportunity",
      "firstRecommendedFix",
      "currentMonthlyEnquiries",
      "currentMonthlyBookedPatients",
      "targetBookings",
      "consultationValue",
      "averageTreatmentValue",
      "availableCommercialCapacity",
      "recommendedAdSpend",
      "estimatedCostPerLead",
      "estimatedLeads",
      "estimatedBookedPatients",
      "breakEvenBookings",
      "commercialDataSource",
      "recommendedPlan",
      "timeline",
      "termsSummary",
      "investmentNotes",
      "nextSteps",
    ]);
    const urlKeys = new Set(["introVideoUrl", "fallbackVideoUrl"]);
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
      if (textKeys.has(key) && fieldValue !== null && fieldValue !== undefined && String(fieldValue).length > 10000) {
        throw new Error(`${key} is too long`);
      }
      if (urlKeys.has(key) && fieldValue !== null && fieldValue !== undefined) {
        const rawUrl = String(fieldValue).trim();
        if (rawUrl.length > 1000) throw new Error(`${key} is too long`);
        if (rawUrl) {
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
          if (!["included", "excluded"].includes(String(scopeItem.inclusionStatus || ""))) {
            throw new Error("scopeItems inclusionStatus must be included or excluded");
          }
          if (!["recurring", "one_off"].includes(String(scopeItem.deliveryType || ""))) {
            throw new Error("scopeItems deliveryType must be recurring or one_off");
          }
          if (typeof scopeItem.isOptionalAddOn !== "boolean") throw new Error("scopeItems isOptionalAddOn must be true or false");
          if (!Number.isInteger(Number(scopeItem.sortOrder))) throw new Error("scopeItems sortOrder must be an integer");
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
