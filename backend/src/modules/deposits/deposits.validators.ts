import { body, param } from "express-validator";

const statuses = ["requested", "paid", "failed", "unpaid", "waived", "refunded"];

export const createDepositValidator = [
  body("contact").trim().notEmpty().withMessage("Contact is required").isLength({ max: 255 }),
  body("contactId").optional({ nullable: true }).isUUID().withMessage("Invalid contact ID format"),
  body("appointmentId").optional({ nullable: true }).isUUID().withMessage("Invalid appointment ID format"),
  body("consultId").optional({ nullable: true }).isUUID().withMessage("Invalid consult ID format"),
  body("treatmentId").optional({ nullable: true }).isUUID().withMessage("Invalid treatment ID format"),
  body("practitionerId").optional({ nullable: true }).isUUID().withMessage("Invalid practitioner ID format"),
  body("treatment").trim().notEmpty().withMessage("Treatment is required").isLength({ max: 255 }),
  body("appointmentDate").optional({ nullable: true }).isISO8601(),
  body("depositAmount").optional().isFloat({ min: 0 }),
  body("depositPaid").optional().isBoolean(),
  body("paidDate").optional({ nullable: true }).isISO8601(),
  body("method").optional({ nullable: true }).trim().isLength({ max: 100 }),
  body("showedUp").optional({ nullable: true }).isBoolean(),
  body("practitioner").optional({ nullable: true }).trim().isLength({ max: 255 }),
  body("status").optional().isIn(statuses),
];

export const createDepositPaymentSessionValidator = [
  body("contactId").optional({ nullable: true }).isUUID().withMessage("Invalid contact ID format"),
  body("consultId").optional({ nullable: true }).isUUID().withMessage("Invalid consult ID format"),
  body("appointmentId").optional({ nullable: true }).isUUID().withMessage("Invalid appointment ID format"),
  body("treatmentId").optional({ nullable: true }).isUUID().withMessage("Invalid treatment ID format"),
  body("practitionerId").optional({ nullable: true }).isUUID().withMessage("Invalid practitioner ID format"),
  body("contactName").optional({ nullable: true }).trim().isLength({ max: 255 }),
  body("treatment").trim().notEmpty().withMessage("Treatment is required").isLength({ max: 255 }),
  body("depositAmount").isFloat({ min: 0.01 }).withMessage("Deposit amount must be greater than zero"),
  body().custom((_, { req }) => {
    if (!req.body.contactId && !req.body.consultId && !req.body.appointmentId && !req.body.contactName) {
      throw new Error("Provide contactId, consultId, appointmentId, or contactName");
    }

    return true;
  }),
  body("successUrl").optional({ nullable: true }).isURL({ require_protocol: true }),
  body("cancelUrl").optional({ nullable: true }).isURL({ require_protocol: true }),
];

export const updateDepositValidator = [
  param("id").isUUID().withMessage("Invalid deposit ID format"),
  body("contact").optional().trim().isLength({ max: 255 }),
  body("contactId").optional({ nullable: true }).isUUID().withMessage("Invalid contact ID format"),
  body("appointmentId").optional({ nullable: true }).isUUID().withMessage("Invalid appointment ID format"),
  body("consultId").optional({ nullable: true }).isUUID().withMessage("Invalid consult ID format"),
  body("treatmentId").optional({ nullable: true }).isUUID().withMessage("Invalid treatment ID format"),
  body("practitionerId").optional({ nullable: true }).isUUID().withMessage("Invalid practitioner ID format"),
  body("treatment").optional().trim().isLength({ max: 255 }),
  body("appointmentDate").optional({ nullable: true }).isISO8601(),
  body("depositAmount").optional().isFloat({ min: 0 }),
  body("depositPaid").optional().isBoolean(),
  body("paidDate").optional({ nullable: true }).isISO8601(),
  body("method").optional({ nullable: true }).trim().isLength({ max: 100 }),
  body("showedUp").optional({ nullable: true }).isBoolean(),
  body("practitioner").optional({ nullable: true }).trim().isLength({ max: 255 }),
  body("status").optional().isIn(statuses),
  body("reminderSent").optional().isBoolean(),
  body("depositRequested").optional().isBoolean(),
];

export const depositIdParamValidator = [
  param("id").isUUID().withMessage("Invalid deposit ID format"),
];

