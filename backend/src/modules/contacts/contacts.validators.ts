import { body, param, query } from "express-validator";
import { hasUsableLeadIdentity } from "./contacts.normalizers.js";

const contactSortFields = ["name", "source", "status", "value", "lastContact", "createdAt", "updatedAt"];
const contactIdParam = () =>
  param("id")
    .isString()
    .trim()
    .notEmpty()
    .isLength({ max: 100 })
    .withMessage("Invalid contact ID format");

const contactMutationValidator = [
  body("externalId").optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
  body("accountName").optional({ nullable: true }).isString().trim().isLength({ max: 255 }),
  body("firstName").optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
  body("lastName").optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
  body("email").optional({ nullable: true, checkFalsy: true }).isEmail().normalizeEmail(),
  body("phone").optional({ nullable: true }).isString().trim().isLength({ max: 30 }),
  body("roleTitle").optional({ nullable: true }).isString().trim().isLength({ max: 120 }),
  body("emailPermission").optional({ nullable: true }).isBoolean().toBoolean(),
  body("phonePermission").optional({ nullable: true }).isBoolean().toBoolean(),
  body("smsPermission").optional({ nullable: true }).isBoolean().toBoolean(),
  body("whatsappPermission").optional({ nullable: true }).isBoolean().toBoolean(),
  body("website")
    .optional({ nullable: true, checkFalsy: true })
    .isURL({ protocols: ["http", "https"], require_protocol: false })
    .withMessage("Website must be a valid URL")
    .isLength({ max: 255 }),
  body("dateOfBirth").optional({ nullable: true, checkFalsy: true }).isISO8601(),
  body("gender").optional({ nullable: true }).isString().trim().isLength({ max: 20 }),
  body("address").optional({ nullable: true }).isString().trim().isLength({ max: 1000 }),
  body("city").optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
  body("state").optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
  body("postalCode").optional({ nullable: true }).isString().trim().isLength({ max: 20 }),
  body("country").optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
  body("tags").optional().isArray({ max: 20 }),
  body("tags.*").optional().isString().trim().isLength({ max: 50 }),
  body("status").optional({ nullable: true }).isString().trim().isLength({ max: 50 }),
  body("leadStatus").optional({ nullable: true }).isString().trim().isLength({ max: 50 }),
  body("source").optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
  body("value").optional({ nullable: true }).isFloat({ min: 0 }),
  body("treatmentInterests").optional().isArray({ max: 20 }),
  body("treatmentInterests.*").optional().isString().trim().isLength({ max: 100 }),
  body("packageInterest").optional({ nullable: true }).isString().trim().isLength({ max: 150 }),
  body("recommendedPackage").optional({ nullable: true }).isString().trim().isLength({ max: 150 }),
  body("notes").optional({ nullable: true }).isString().trim().isLength({ max: 5000 }),
  body("lastContactAt").optional({ nullable: true, checkFalsy: true }).isISO8601(),
];

export const listContactsValidator = [
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 250 }).toInt(),
  query("pageSize").optional().isInt({ min: 1, max: 250 }).toInt(),
  query("search").optional().isString().trim().isLength({ max: 255 }),
  query("status").optional().isString().trim().isLength({ max: 50 }),
  query("leadStatus").optional().isString().trim().isLength({ max: 50 }),
  query("source").optional().isString().trim().isLength({ max: 100 }),
  query("tag").optional().isString().trim().isLength({ max: 50 }),
  query("campaign").optional().isString().trim().isLength({ max: 100 }),
  query("utmSource").optional().isString().trim().isLength({ max: 100 }),
  query("utmMedium").optional().isString().trim().isLength({ max: 100 }),
  query("utmCampaign").optional().isString().trim().isLength({ max: 100 }),
  query("createdFrom").optional().isISO8601(),
  query("createdTo").optional().isISO8601(),
  query("sortBy").optional().isIn(contactSortFields),
  query("sortOrder").optional().isIn(["asc", "desc"]),
  query("sortDir").optional().isIn(["asc", "desc"]),
];

export const createContactValidator = [
  ...contactMutationValidator,
  body().custom((value) => {
    if (hasUsableLeadIdentity(value)) return true;
    throw new Error("Lead must include an account or contact name and an email or phone number");
  }),
];

export const updateContactValidator = [
  contactIdParam(),
  ...contactMutationValidator,
];

export const contactIdParamValidator = [
  contactIdParam(),
];

export const leadCallOutcomeActionValidator = [
  contactIdParam(),
  body("callId").isUUID().withMessage("Valid call ID is required"),
  body("commercialOutcome").optional({ nullable: true }).isIn([
    "booked_consult",
    "asked_for_prices",
    "not_suitable",
    "missed_no_answer",
    "follow_up_required",
    "existing_patient",
    "spam",
    "lost",
  ]),
  body("bookingIntent").optional({ nullable: true }).isIn(["none", "low", "medium", "high", "booked"]),
  body("notes").optional({ nullable: true }).isString().trim().isLength({ max: 5000 }),
  body("qualityScore").optional({ nullable: true }).isInt({ min: 0, max: 100 }).toInt(),
  body("sentiment").optional({ nullable: true }).isIn(["positive", "neutral", "negative", "unknown"]),
  body("treatmentMentioned").optional({ nullable: true }).isString().trim().isLength({ max: 255 }),
  body("missedRecoveryStatus").optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
];

export const leadMessageTemplateActionValidator = [
  contactIdParam(),
  body("templateId").isUUID().withMessage("Valid template ID is required"),
  body("channel").optional().isIn(["email", "sms"]),
  body("sendNow").optional().isBoolean().toBoolean(),
  body("variables").optional({ nullable: true }).isObject(),
];

export const leadBookingActionValidator = [
  contactIdParam(),
  body("dateTime").isISO8601(),
  body("clinicianId").optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
  body("status").optional().isIn(["Scheduled", "Completed", "NoShow", "Cancelled"]),
  body("treatment").optional({ nullable: true }).isString().trim().isLength({ max: 255 }),
  body("valueCents").optional({ nullable: true }).isInt({ min: 0, max: 1000000000 }).toInt(),
  body("durationMinutes").optional({ nullable: true }).isInt({ min: 5, max: 480 }).toInt(),
  body("noShowReason").optional({ nullable: true }).isString().trim().isLength({ max: 255 }),
  body("consultNotes").optional({ nullable: true }).isString().trim().isLength({ max: 5000 }),
];

export const leadDepositActionValidator = [
  contactIdParam(),
  body("depositId").optional({ nullable: true }).isUUID().withMessage("Invalid deposit ID format"),
  body("appointmentId").optional({ nullable: true }).isUUID().withMessage("Invalid appointment ID format"),
  body("contact").optional({ nullable: true }).trim().isLength({ max: 255 }),
  body("treatment").optional({ nullable: true }).trim().isLength({ max: 255 }),
  body("appointmentDate").optional({ nullable: true }).isISO8601(),
  body("depositAmount").optional().isFloat({ min: 0 }).toFloat(),
  body("depositPaid").optional().isBoolean().toBoolean(),
  body("paidDate").optional({ nullable: true }).isISO8601(),
  body("method").optional({ nullable: true }).trim().isLength({ max: 100 }),
  body("showedUp").optional({ nullable: true }).isBoolean().toBoolean(),
  body("practitioner").optional({ nullable: true }).trim().isLength({ max: 255 }),
  body("status").optional().isIn(["requested", "paid", "failed", "unpaid", "waived", "refunded"]),
  body("reminderSent").optional().isBoolean().toBoolean(),
  body("depositRequested").optional().isBoolean().toBoolean(),
  body().custom((value) => {
    if (value.depositId || value.treatment) return true;
    throw new Error("Treatment is required when creating a deposit");
  }),
];

export const leadTaskActionValidator = [
  contactIdParam(),
  body("title").trim().notEmpty().withMessage("Task title is required").isLength({ max: 255 }),
  body("description").optional({ nullable: true }).trim(),
  body("priority").optional().isIn(["low", "medium", "high"]),
  body("status").optional().isIn(["pending", "completed"]),
  body("category").optional({ nullable: true }).trim().isLength({ max: 100 }),
  body("due").optional({ nullable: true }).trim().isLength({ max: 100 }),
  body("dueDate").optional({ nullable: true }).isISO8601().toDate(),
  body("assignedTo").optional({ nullable: true }).trim().isLength({ max: 255 }),
];

export const importContactsValidator = [
  body("filename").optional().isString().trim().isLength({ max: 255 }),
  body("mode").optional().isIn(["create_only", "upsert"]),
  body("sourceUrl").optional({ nullable: true, checkFalsy: true }).isURL({ protocols: ["https"], require_protocol: true }),
  body("rows").optional().isArray({ min: 1, max: 1000 }).withMessage("rows must contain 1 to 1000 contacts"),
  body().custom((value) => {
    if (Array.isArray(value.rows) && value.rows.length > 0) return true;
    if (typeof value.sourceUrl === "string" && value.sourceUrl.trim()) return true;
    throw new Error("Provide contact rows or a Google Sheets source URL");
  }),
  body("rows.*.externalId").optional().isString().trim().isLength({ max: 100 }),
  body("rows.*.accountName").optional().isString().trim().isLength({ max: 255 }),
  body("rows.*.firstName").optional().isString().trim().isLength({ max: 100 }),
  body("rows.*.lastName").optional().isString().trim().isLength({ max: 100 }),
  body("rows.*.email").optional({ nullable: true, checkFalsy: true }).isEmail().normalizeEmail(),
  body("rows.*.phone").optional().isString().trim().isLength({ max: 30 }),
  body("rows.*.roleTitle").optional().isString().trim().isLength({ max: 120 }),
  body("rows.*.emailPermission").optional({ nullable: true }).isBoolean().toBoolean(),
  body("rows.*.phonePermission").optional({ nullable: true }).isBoolean().toBoolean(),
  body("rows.*.smsPermission").optional({ nullable: true }).isBoolean().toBoolean(),
  body("rows.*.whatsappPermission").optional({ nullable: true }).isBoolean().toBoolean(),
  body("rows.*.website")
    .optional({ nullable: true, checkFalsy: true })
    .isURL({ protocols: ["http", "https"], require_protocol: false })
    .withMessage("Website must be a valid URL")
    .isLength({ max: 255 }),
  body("rows.*.dateOfBirth").optional({ nullable: true, checkFalsy: true }).isISO8601(),
  body("rows.*.gender").optional().isString().trim().isLength({ max: 20 }),
  body("rows.*.address").optional().isString().trim().isLength({ max: 1000 }),
  body("rows.*.city").optional().isString().trim().isLength({ max: 100 }),
  body("rows.*.state").optional().isString().trim().isLength({ max: 100 }),
  body("rows.*.postalCode").optional().isString().trim().isLength({ max: 20 }),
  body("rows.*.country").optional().isString().trim().isLength({ max: 100 }),
  body("rows.*.tags").optional().isArray({ max: 20 }),
  body("rows.*.tags.*").optional().isString().trim().isLength({ max: 50 }),
  body("rows.*.status").optional().isString().trim().isLength({ max: 50 }),
  body("rows.*.source").optional().isString().trim().isLength({ max: 100 }),
  body("rows.*.value").optional({ nullable: true }).isFloat({ min: 0 }),
  body("rows.*.treatmentInterests").optional().isArray({ max: 20 }),
  body("rows.*.treatmentInterests.*").optional().isString().trim().isLength({ max: 100 }),
  body("rows.*.notes").optional().isString().trim().isLength({ max: 5000 }),
  body("rows.*.lastContactAt").optional({ nullable: true, checkFalsy: true }).isISO8601(),
];

export const importContactsPreviewValidator = [
  body("sourceUrl").isURL({ protocols: ["https"], require_protocol: true }).withMessage("Valid Google Sheets URL is required"),
];

export const importBatchIdParamValidator = [
  param("id").isUUID().withMessage("Invalid import batch ID"),
];

export const resolveDuplicateValidator = [
  param("candidateId").isUUID().withMessage("valid candidate ID is required"),
  body("status").isIn(["confirmed_duplicate", "not_duplicate", "merged", "ignored"]),
];
