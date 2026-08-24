import { body } from "express-validator";

const providers = ["gocardless", "stripe", "manual"];
const mandateStatuses = ["setup_required", "pending_customer_authorisation", "submitted", "active", "failed", "cancelled", "expired"];

export const createDirectDebitMandateSetupValidator = [
  body("provider").optional({ nullable: true }).isIn(providers).withMessage("Unsupported Direct Debit provider."),
  body("clientAccountProfileId").optional({ nullable: true }).isUUID().withMessage("Invalid client account profile ID."),
  body("providerCustomerId").optional({ nullable: true }).trim().isLength({ max: 255 }),
  body("setupReference").optional({ nullable: true }).trim().isLength({ max: 255 }),
  body("setupUrl").optional({ nullable: true }).isURL({ require_protocol: true }).withMessage("Setup URL must be a valid URL."),
  body("metadata").optional({ nullable: true }).isObject().withMessage("Metadata must be an object."),
];

export const directDebitProviderCallbackValidator = [
  body("clinicId").isUUID().withMessage("Clinic ID is required."),
  body("provider").optional({ nullable: true }).isIn(providers).withMessage("Unsupported Direct Debit provider."),
  body("providerEventId").trim().notEmpty().withMessage("Provider event ID is required.").isLength({ max: 255 }),
  body("providerMandateId").trim().notEmpty().withMessage("Provider mandate ID is required.").isLength({ max: 255 }),
  body("status").isIn(mandateStatuses).withMessage("Unsupported Direct Debit mandate status."),
  body("eventType").optional({ nullable: true }).trim().isLength({ max: 255 }),
  body("providerCustomerId").optional({ nullable: true }).trim().isLength({ max: 255 }),
  body("failureReason").optional({ nullable: true }).trim().isLength({ max: 1000 }),
  body("payload").optional({ nullable: true }).isObject().withMessage("Payload must be an object."),
];

export const reconcileDirectDebitMandatesValidator = [
  body("provider").optional({ nullable: true }).isIn(providers).withMessage("Unsupported Direct Debit provider."),
  body("providerStatuses").isArray({ min: 1, max: 500 }).withMessage("Provider statuses are required."),
  body("providerStatuses.*.providerMandateId").trim().notEmpty().withMessage("Provider mandate ID is required.").isLength({ max: 255 }),
  body("providerStatuses.*.status").isIn(mandateStatuses).withMessage("Unsupported Direct Debit mandate status."),
];
