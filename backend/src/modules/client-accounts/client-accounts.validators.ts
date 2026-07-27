import { body, param, query } from "express-validator";

const serviceTypes = ["ppc", "seo", "gbp", "website", "landing_pages", "cro", "strategy", "other"];
const serviceStatuses = ["onboarding", "active", "paused", "ended", "archived"];
const editableServiceStatuses = ["onboarding", "active", "paused", "ended"];
const contractStatuses = ["active", "trial", "pending", "paused", "cancelled", "expired"];
const clientStatuses = ["prospect", "onboarding", "active", "paused", "at_risk", "churned", "inactive"];
const paymentStatuses = ["not_started", "pending", "paid", "overdue", "failed", "cancelled"];
const invoiceStatuses = ["not_required", "not_sent", "sent", "paid", "overdue", "disputed", "void"];
const healthStatuses = ["healthy", "attention_needed", "at_risk", "critical"];
const churnRisks = ["low", "medium", "high", "critical"];
const clientDocumentTypes = [
  "main_client_folder",
  "audit",
  "proposal",
  "contract_admin",
  "onboarding",
  "website_assets",
  "reports",
  "strategy_looms",
  "ads",
  "seo_content",
  "landing_pages",
];

function isObjectPayloadWithAnyField(value: unknown, fields: string[]) {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    fields.some((field) => Object.prototype.hasOwnProperty.call(value, field)),
  );
}
const clientAccessItemTypes = [
  "website",
  "ga4",
  "gsc",
  "gtm",
  "google_ads",
  "gbp",
  "meta",
  "brand_assets",
  "treatment_pricing_info",
  "reporting_access",
];
const clientAccessItemStatuses = ["requested", "received", "not_needed"];
const growthScoreCategoryFields = [
  "websiteVisibility",
  "seo",
  "gbp",
  "tracking",
  "conversion",
  "leadHandling",
  "responseSpeed",
  "enquiryVisibility",
  "treatmentPerformance",
  "revenueLeakage",
  "growthOpportunity",
];

const growthScoreValidators = [
  body("growthScore").optional({ nullable: true }).isObject(),
  body("growthScore.overall").optional({ nullable: true }).isFloat({ min: 0, max: 100 }).toFloat(),
  body("growthScore.categories").optional({ nullable: true }).isObject(),
  ...growthScoreCategoryFields.map((field) =>
    body(`growthScore.categories.${field}`).optional({ nullable: true }).isFloat({ min: 0, max: 100 }).toFloat(),
  ),
  body("growthScore.recommendedPackage").optional({ nullable: true }).trim().isLength({ max: 150 }).withMessage("Growth Score recommended package must be 150 characters or fewer"),
  body("growthScore.gapSummary").optional({ nullable: true }).trim().isLength({ max: 5000 }).withMessage("Growth Score gap summary must be 5000 characters or fewer"),
  body("growthScore.updatedAt").optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage("Growth Score timestamp must be a valid date"),
  body("growthScoreOverall").optional({ nullable: true }).isFloat({ min: 0, max: 100 }).toFloat(),
  body("growthScoreCategories").optional({ nullable: true }).isObject(),
  ...growthScoreCategoryFields.map((field) =>
    body(`growthScoreCategories.${field}`).optional({ nullable: true }).isFloat({ min: 0, max: 100 }).toFloat(),
  ),
  body("growthScoreRecommendedPackage").optional({ nullable: true }).trim().isLength({ max: 150 }).withMessage("Growth Score recommended package must be 150 characters or fewer"),
  body("growthScoreGapSummary").optional({ nullable: true }).trim().isLength({ max: 5000 }).withMessage("Growth Score gap summary must be 5000 characters or fewer"),
  body("growthScoreUpdatedAt").optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage("Growth Score timestamp must be a valid date"),
];

const accountCommercialValidators = [
  body("monthlyPrice").optional({ nullable: true }).isFloat({ min: 0, max: 99999999.99 }).withMessage("Monthly price/MRR must be a positive amount").toFloat(),
  body("setupFee").optional({ nullable: true }).isFloat({ min: 0, max: 99999999.99 }).withMessage("Setup fee must be a positive amount").toFloat(),
  body("currency").optional({ nullable: true }).trim().isLength({ min: 3, max: 3 }).withMessage("Currency must be a 3-letter code").toUpperCase(),
  body("contractStartDate").optional({ nullable: true }).isISO8601().withMessage("Contract start date must be a valid date"),
  body("noticeDate").optional({ nullable: true }).isISO8601().withMessage("Notice date must be a valid date"),
  body("paymentStatus").optional().isIn(paymentStatuses),
  body("invoiceStatus").optional().isIn(invoiceStatuses),
  body("paymentNotes").optional({ nullable: true }).trim().isLength({ max: 5000 }).withMessage("Payment notes must be 5000 characters or fewer"),
];

function userIdentifier(field: "accountManagerId" | "ownerId", label: string) {
  return body(field)
    .optional({ nullable: true })
    .isString()
    .trim()
    .matches(/^[A-Za-z0-9_-]{1,36}$/)
    .withMessage(`${label} must be a valid user ID`);
}

export const listClientAccountsValidator = [
  query("search").optional().trim().isLength({ max: 120 }).withMessage("Search must be 120 characters or fewer"),
  query("healthStatus").optional().isIn([...healthStatuses, "all"]),
  query("clientStatus").optional().isIn([...clientStatuses, "all"]),
  query("churnRisk").optional().isIn([...churnRisks, "all"]),
  query("contractStatus").optional().isIn([...contractStatuses, "all"]),
];

export const createClientAccountValidator = [
  body("name").trim().isLength({ min: 1, max: 255 }).withMessage("Client account name is required"),
  body("email").optional({ nullable: true }).trim().isEmail().withMessage("Email must be valid"),
  body("phone").optional({ nullable: true }).trim().isLength({ max: 20 }).withMessage("Phone must be 20 characters or fewer"),
  body("website").optional({ nullable: true }).trim().isLength({ max: 255 }).withMessage("Website must be 255 characters or fewer"),
  body("address").optional({ nullable: true }).trim().isLength({ max: 1000 }).withMessage("Address must be 1000 characters or fewer"),
  body("city").optional({ nullable: true }).trim().isLength({ max: 100 }).withMessage("City must be 100 characters or fewer"),
  body("state").optional({ nullable: true }).trim().isLength({ max: 100 }).withMessage("State must be 100 characters or fewer"),
  body("postalCode").optional({ nullable: true }).trim().isLength({ max: 20 }).withMessage("Postal code must be 20 characters or fewer"),
  body("country").optional({ nullable: true }).trim().isLength({ max: 100 }).withMessage("Country must be 100 characters or fewer"),
  userIdentifier("accountManagerId", "Account manager ID"),
  body("activeServices").optional().isArray().withMessage("Active services must be an array"),
  body("activeServices.*").optional().trim().isLength({ min: 1, max: 100 }).withMessage("Active service names must be 1-100 characters"),
  body("onboardingStatus").optional().isIn(["not_started", "in_progress", "completed", "paused"]),
  body("healthStatus").optional().isIn(["healthy", "attention_needed", "at_risk", "critical"]),
  body("clientStatus").optional().isIn(clientStatuses),
  body("currentPackage").optional({ nullable: true }).trim().isLength({ max: 150 }).withMessage("Current package must be 150 characters or fewer"),
  ...accountCommercialValidators,
  body("recommendedNextPackage").optional({ nullable: true }).trim().isLength({ max: 150 }).withMessage("Recommended next package must be 150 characters or fewer"),
  body("upsellOpportunity").optional({ nullable: true }).trim().isLength({ max: 255 }).withMessage("Upsell opportunity must be 255 characters or fewer"),
  ...growthScoreValidators,
  body("churnRisk").optional().isIn(["low", "medium", "high", "critical"]),
  body("renewalDate").optional({ nullable: true }).isISO8601().withMessage("Renewal date must be a valid date"),
  body("contractStatus").optional().isIn(["active", "trial", "pending", "paused", "cancelled", "expired"]),
  body("keyNotes").optional({ nullable: true }).trim().isLength({ max: 10000 }).withMessage("Key notes must be 10000 characters or fewer"),
];

export const createClientAccountFromContactValidator = [
  body("contactId").isString().trim().notEmpty().isLength({ max: 100 }).withMessage("A valid contact ID is required"),
  body("accountName").optional({ nullable: true }).trim().isLength({ max: 255 }).withMessage("Client account name must be 255 characters or fewer"),
  userIdentifier("accountManagerId", "Account manager ID"),
  body("activeServices").optional().isArray().withMessage("Active services must be an array"),
  body("activeServices.*").optional().trim().isLength({ min: 1, max: 100 }).withMessage("Active service names must be 1-100 characters"),
  body("onboardingStatus").optional().isIn(["not_started", "in_progress", "completed", "paused"]),
  body("healthStatus").optional().isIn(["healthy", "attention_needed", "at_risk", "critical"]),
  body("clientStatus").optional().isIn(clientStatuses),
  body("currentPackage").optional({ nullable: true }).trim().isLength({ max: 150 }).withMessage("Current package must be 150 characters or fewer"),
  ...accountCommercialValidators,
  body("recommendedNextPackage").optional({ nullable: true }).trim().isLength({ max: 150 }).withMessage("Recommended next package must be 150 characters or fewer"),
  body("upsellOpportunity").optional({ nullable: true }).trim().isLength({ max: 255 }).withMessage("Upsell opportunity must be 255 characters or fewer"),
  ...growthScoreValidators,
  body("churnRisk").optional().isIn(["low", "medium", "high", "critical"]),
  body("renewalDate").optional({ nullable: true }).isISO8601().withMessage("Renewal date must be a valid date"),
  body("contractStatus").optional().isIn(["active", "trial", "pending", "paused", "cancelled", "expired"]),
  body("keyNotes").optional({ nullable: true }).trim().isLength({ max: 10000 }).withMessage("Key notes must be 10000 characters or fewer"),
];

export const convertWonDealToClientValidator = [
  body("dealId").isString().trim().notEmpty().isLength({ max: 100 }).withMessage("A valid won deal ID is required"),
  body("accountName").optional({ nullable: true }).trim().isLength({ max: 255 }).withMessage("Client account name must be 255 characters or fewer"),
  userIdentifier("accountManagerId", "Account manager ID"),
  body("activeServices").optional().isArray().withMessage("Active services must be an array"),
  body("activeServices.*").optional().trim().isLength({ min: 1, max: 100 }).withMessage("Active service names must be 1-100 characters"),
  body("onboardingStatus").optional().isIn(["not_started", "in_progress", "completed", "paused"]),
  body("healthStatus").optional().isIn(["healthy", "attention_needed", "at_risk", "critical"]),
  body("clientStatus").optional().isIn(clientStatuses),
  body("currentPackage").optional({ nullable: true }).trim().isLength({ max: 150 }).withMessage("Current package must be 150 characters or fewer"),
  ...accountCommercialValidators,
  body("recommendedNextPackage").optional({ nullable: true }).trim().isLength({ max: 150 }).withMessage("Recommended next package must be 150 characters or fewer"),
  body("upsellOpportunity").optional({ nullable: true }).trim().isLength({ max: 255 }).withMessage("Upsell opportunity must be 255 characters or fewer"),
  ...growthScoreValidators,
  body("churnRisk").optional().isIn(["low", "medium", "high", "critical"]),
  body("renewalDate").optional({ nullable: true }).isISO8601().withMessage("Renewal date must be a valid date"),
  body("contractStatus").optional().isIn(["active", "trial", "pending", "paused", "cancelled", "expired"]),
  body("keyNotes").optional({ nullable: true }).trim().isLength({ max: 10000 }).withMessage("Key notes must be 10000 characters or fewer"),
  body("createOnboardingTasks")
    .optional()
    .custom((value) => value === true)
    .withMessage("Won conversion always creates onboarding tasks"),
];

export const updateClientAccountDriveFolderValidator = [
  param("clinicId").isString().trim().isLength({ min: 1, max: 100 }).withMessage("Valid client account ID is required"),
  body()
    .custom((value) => isObjectPayloadWithAnyField(value, ["folderUrl", "folderId"]))
    .withMessage("A Google Drive folder URL or ID field is required"),
  body("folderUrl")
    .optional({ nullable: true })
    .custom((value) => value === null || (typeof value === "string" && value.trim().length <= 500))
    .withMessage("Google Drive folder or ZIP URL must be 500 characters or fewer"),
  body("folderId")
    .optional({ nullable: true })
    .custom((value) => value === null || (typeof value === "string" && /^[A-Za-z0-9_-]{10,255}$/.test(value.trim())))
    .withMessage("Google Drive item ID is not valid"),
  body("displayName")
    .optional({ nullable: true })
    .custom((value) => value === null || (typeof value === "string" && value.trim().length <= 255))
    .withMessage("Google Drive title must be 255 characters or fewer"),
];

export const clientAccountDocumentTypeParamValidator = [
  param("clinicId").isString().trim().isLength({ min: 1, max: 100 }).withMessage("Valid client account ID is required"),
  param("documentType").isIn(clientDocumentTypes).withMessage("Document type is not supported"),
];

const updateClientAccountDocumentLinkBodyValidator = [
  body()
    .custom((value) => isObjectPayloadWithAnyField(value, ["driveUrl", "driveItemId"]))
    .withMessage("A Google Drive URL or item ID field is required"),
  body("driveUrl")
    .optional({ nullable: true })
    .custom((value) => value === null || (typeof value === "string" && value.trim().length <= 500))
    .withMessage("Google Drive URL must be 500 characters or fewer"),
  body("driveItemId")
    .optional({ nullable: true })
    .custom((value) =>
      value === null ||
      (typeof value === "string" && (value.trim() === "" || /^[A-Za-z0-9_-]{5,255}$/.test(value.trim()))),
    )
    .withMessage("Google Drive item ID is not valid"),
  body("displayName")
    .optional({ nullable: true })
    .custom((value) => value === null || (typeof value === "string" && value.trim().length <= 255))
    .withMessage("Document title must be 255 characters or fewer"),
  body("notes")
    .optional({ nullable: true })
    .custom((value) => value === null || (typeof value === "string" && value.trim().length <= 2000))
    .withMessage("Document notes must be 2000 characters or fewer"),
];

export const updateClientAccountDocumentLinkValidator = [
  ...clientAccountDocumentTypeParamValidator,
  ...updateClientAccountDocumentLinkBodyValidator,
];

export const updateMainClientFolderDocumentLinkValidator = [
  param("clinicId").isString().trim().isLength({ min: 1, max: 100 }).withMessage("Valid client account ID is required"),
  ...updateClientAccountDocumentLinkBodyValidator,
];

export const clientAccountAccessItemTypeParamValidator = [
  param("clinicId").isString().trim().isLength({ min: 1, max: 100 }).withMessage("Valid client account ID is required"),
  param("itemType").isIn(clientAccessItemTypes).withMessage("Access item type is not supported"),
];

export const updateClientAccountAccessItemValidator = [
  ...clientAccountAccessItemTypeParamValidator,
  body("status").isIn(clientAccessItemStatuses).withMessage("Access status must be requested, received, or not needed"),
  body("notes")
    .optional({ nullable: true })
    .custom((value) => value === null || (typeof value === "string" && value.trim().length <= 2000))
    .withMessage("Access notes must be 2000 characters or fewer"),
];

const driveParentId = () =>
  body("parentId")
    .optional()
    .isString()
    .trim()
    .matches(/^(root|[A-Za-z0-9_-]{10,255})$/)
    .withMessage("Google Drive parent folder ID is not valid");

export const listClientAccountDriveFoldersValidator = [
  param("clinicId").isString().trim().isLength({ min: 1, max: 100 }).withMessage("Valid client account ID is required"),
  query("parentId")
    .optional()
    .isString()
    .trim()
    .matches(/^(root|[A-Za-z0-9_-]{10,255})$/)
    .withMessage("Google Drive parent folder ID is not valid"),
];

export const createClientAccountDriveFolderValidator = [
  param("clinicId").isString().trim().isLength({ min: 1, max: 100 }).withMessage("Valid client account ID is required"),
  body("name").isString().trim().isLength({ min: 1, max: 150 }).withMessage("Folder name must be 1-150 characters"),
  driveParentId(),
];

export const uploadClientAccountDriveFileValidator = [
  param("clinicId").isString().trim().isLength({ min: 1, max: 100 }).withMessage("Valid client account ID is required"),
  driveParentId(),
];

export const clientAccountDriveFileValidator = [
  param("clinicId").isString().trim().isLength({ min: 1, max: 100 }).withMessage("Valid client account ID is required"),
  param("fileId")
    .isString()
    .trim()
    .matches(/^[A-Za-z0-9_-]{10,255}$/)
    .withMessage("Google Drive file ID is not valid"),
];

export const renameClientAccountDriveFileValidator = [
  ...clientAccountDriveFileValidator,
  body("name").isString().trim().isLength({ min: 1, max: 255 }).withMessage("File name must be 1-255 characters"),
];

export const clientAccountClinicIdParamValidator = [
  param("clinicId").isString().trim().isLength({ min: 1, max: 100 }).withMessage("Valid client account ID is required"),
];

export const clientAccountContactLinkValidator = [
  param("clinicId").isString().trim().isLength({ min: 1, max: 100 }).withMessage("Valid client account ID is required"),
  param("contactId").isString().trim().isLength({ min: 1, max: 100 }).withMessage("Valid contact ID is required"),
];

export const clientAccountContactIdParamValidator = [
  param("contactId").isString().trim().isLength({ min: 1, max: 100 }).withMessage("Valid contact ID is required"),
];

export const updateClientAccountProfileValidator = [
  userIdentifier("accountManagerId", "Account manager ID"),
  body("activeServices").optional().isArray().withMessage("Active services must be an array"),
  body("activeServices.*").optional().trim().isLength({ min: 1, max: 100 }).withMessage("Active service names must be 1-100 characters"),
  body("onboardingStatus").optional().isIn(["not_started", "in_progress", "completed", "paused"]),
  body("healthStatus").optional().isIn(["healthy", "attention_needed", "at_risk", "critical"]),
  body("clientStatus").optional().isIn(clientStatuses),
  body("currentPackage").optional({ nullable: true }).trim().isLength({ max: 150 }).withMessage("Current package must be 150 characters or fewer"),
  ...accountCommercialValidators,
  body("recommendedNextPackage").optional({ nullable: true }).trim().isLength({ max: 150 }).withMessage("Recommended next package must be 150 characters or fewer"),
  body("upsellOpportunity").optional({ nullable: true }).trim().isLength({ max: 255 }).withMessage("Upsell opportunity must be 255 characters or fewer"),
  ...growthScoreValidators,
  body("churnRisk").optional().isIn(["low", "medium", "high", "critical"]),
  body("renewalDate").optional({ nullable: true }).isISO8601().withMessage("Renewal date must be a valid date"),
  body("contractStatus").optional().isIn(["active", "trial", "pending", "paused", "cancelled", "expired"]),
  body("keyNotes").optional({ nullable: true }).trim().isLength({ max: 10000 }).withMessage("Key notes must be 10000 characters or fewer"),
];

export const listClientAccountServicesValidator = [
  query("includeArchived").optional().isBoolean().withMessage("includeArchived must be true or false"),
  query("includeAllClinics").optional().isBoolean().withMessage("includeAllClinics must be true or false"),
  query("status").optional().isIn(serviceStatuses),
  query("contractStatus").optional().isIn(contractStatuses),
  query("renewalFrom").optional().isISO8601().withMessage("renewalFrom must be a valid date"),
  query("renewalTo").optional().isISO8601().withMessage("renewalTo must be a valid date"),
];

export const createClientAccountServiceValidator = [
  body("serviceType").isIn(serviceTypes).withMessage("Service type is required"),
  body("name").trim().isLength({ min: 1, max: 150 }).withMessage("Service name must be 1-150 characters"),
  body("status").optional().isIn(serviceStatuses),
  body("startDate").optional({ nullable: true }).isISO8601().withMessage("Start date must be a valid date"),
  body("renewalDate").optional({ nullable: true }).isISO8601().withMessage("Renewal date must be a valid date"),
  body("endDate").optional({ nullable: true }).isISO8601().withMessage("End date must be a valid date"),
  userIdentifier("ownerId", "Owner ID"),
  body("recurringValue").optional({ nullable: true }).isDecimal({ decimal_digits: "0,2" }).withMessage("Recurring value must be a decimal amount"),
  body("currency").optional().trim().isLength({ min: 3, max: 3 }).withMessage("Currency must be a 3-letter code"),
  body("contractStatus").optional().isIn(contractStatuses),
  body("notes").optional({ nullable: true }).trim().isLength({ max: 10000 }).withMessage("Notes must be 10000 characters or fewer"),
];

export const updateClientAccountServiceValidator = [
  param("serviceId").isUUID().withMessage("Valid service ID is required"),
  body("serviceType").optional().isIn(serviceTypes),
  body("name").optional().trim().isLength({ min: 1, max: 150 }).withMessage("Service name must be 1-150 characters"),
  body("status").optional().isIn(editableServiceStatuses).withMessage("Use the archive endpoint to archive services"),
  body("startDate").optional({ nullable: true }).isISO8601().withMessage("Start date must be a valid date"),
  body("renewalDate").optional({ nullable: true }).isISO8601().withMessage("Renewal date must be a valid date"),
  body("endDate").optional({ nullable: true }).isISO8601().withMessage("End date must be a valid date"),
  userIdentifier("ownerId", "Owner ID"),
  body("recurringValue").optional({ nullable: true }).isDecimal({ decimal_digits: "0,2" }).withMessage("Recurring value must be a decimal amount"),
  body("currency").optional().trim().isLength({ min: 3, max: 3 }).withMessage("Currency must be a 3-letter code"),
  body("contractStatus").optional().isIn(contractStatuses),
  body("notes").optional({ nullable: true }).trim().isLength({ max: 10000 }).withMessage("Notes must be 10000 characters or fewer"),
];

export const clientAccountServiceIdParamValidator = [
  param("serviceId").isUUID().withMessage("Valid service ID is required"),
];
