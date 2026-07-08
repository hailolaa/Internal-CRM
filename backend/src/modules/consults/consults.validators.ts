import { body, param } from "express-validator";
import { consultDepositStatuses, consultOutcomes } from "./consults.constants.js";

const consultMutationValidator = [
  body("contactId").optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
  body("appointmentId").optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
  body("patientName").optional({ nullable: true }).isString().trim().isLength({ max: 255 }),
  body("treatment").optional().isString().trim().isLength({ min: 1, max: 255 }),
  body("practitioner").optional({ nullable: true }).isString().trim().isLength({ max: 255 }),
  body("practitionerId").optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
  body("outcome").optional().isIn(consultOutcomes),
  body("revenue").optional({ nullable: true }).isFloat({ min: 0 }).toFloat(),
  body("date").optional({ nullable: true, checkFalsy: true }).isISO8601(),
  body("notes").optional({ nullable: true }).isString().trim().isLength({ max: 2000 }),
  body("depositStatus").optional({ nullable: true }).isIn(consultDepositStatuses),
  body("lostReason").optional({ nullable: true }).isString().trim().isLength({ max: 255 }),
];

export const createConsultValidator = [
  body("treatment").isString().trim().notEmpty().isLength({ max: 255 }),
  body("outcome").isIn(consultOutcomes),
  ...consultMutationValidator,
];

export const updateConsultValidator = [
  param("id").isString().trim().isLength({ min: 1, max: 100 }),
  ...consultMutationValidator,
];
