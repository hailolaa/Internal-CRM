import { body, param, query } from "express-validator";

const serviceTypes = ["ppc", "seo", "gbp", "website", "landing_pages", "cro", "strategy", "other"];
const serviceStatuses = ["onboarding", "active", "paused", "ended", "archived"];
const editableServiceStatuses = ["onboarding", "active", "paused", "ended"];
const contractStatuses = ["active", "trial", "pending", "paused", "cancelled", "expired"];
const clientStatuses = ["prospect", "onboarding", "active", "paused", "at_risk", "churned", "inactive"];
const healthStatuses = ["healthy", "attention_needed", "at_risk", "critical"];
const churnRisks = ["low", "medium", "high", "critical"];

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
  body("churnRisk").optional().isIn(["low", "medium", "high", "critical"]),
  body("renewalDate").optional({ nullable: true }).isISO8601().withMessage("Renewal date must be a valid date"),
  body("contractStatus").optional().isIn(["active", "trial", "pending", "paused", "cancelled", "expired"]),
  body("keyNotes").optional({ nullable: true }).trim().isLength({ max: 10000 }).withMessage("Key notes must be 10000 characters or fewer"),
];

export const updateClientAccountDriveFolderValidator = [
  param("clinicId").isString().trim().isLength({ min: 1, max: 100 }).withMessage("Valid client account ID is required"),
  body("folderUrl")
    .optional({ nullable: true })
    .custom((value) => value === null || String(value).trim().length <= 500)
    .withMessage("Google Drive folder URL must be 500 characters or fewer"),
  body("folderId")
    .optional({ nullable: true })
    .custom((value) => value === null || /^[A-Za-z0-9_-]{10,255}$/.test(String(value).trim()))
    .withMessage("Google Drive folder ID is not valid"),
];

export const updateClientAccountProfileValidator = [
  userIdentifier("accountManagerId", "Account manager ID"),
  body("activeServices").optional().isArray().withMessage("Active services must be an array"),
  body("activeServices.*").optional().trim().isLength({ min: 1, max: 100 }).withMessage("Active service names must be 1-100 characters"),
  body("onboardingStatus").optional().isIn(["not_started", "in_progress", "completed", "paused"]),
  body("healthStatus").optional().isIn(["healthy", "attention_needed", "at_risk", "critical"]),
  body("clientStatus").optional().isIn(clientStatuses),
  body("currentPackage").optional({ nullable: true }).trim().isLength({ max: 150 }).withMessage("Current package must be 150 characters or fewer"),
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
