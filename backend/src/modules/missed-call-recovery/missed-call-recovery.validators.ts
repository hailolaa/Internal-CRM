import { body, param } from "express-validator";

export const missedCallRecoveryIdParamValidator = [
  param("id").isUUID().withMessage("A valid missed-call recovery ID is required"),
];

export const updateMissedCallRecoveryStateValidator = [
  ...missedCallRecoveryIdParamValidator,
  body("state")
    .isIn(["attempted", "contacted", "booked", "closed_no_response"])
    .withMessage("State must be attempted, contacted, booked or closed_no_response"),
];

export const clinicGrowerMappingIdParamValidator = [
  param("id").isUUID().withMessage("A valid ClinicGrower mapping ID is required"),
];

export const createClinicGrowerMappingValidator = [
  body("clientAccountProfileId").isUUID().withMessage("A valid client account profile is required"),
  body("clinicGrowerClinicId").isString().trim().isLength({ min: 1, max: 100 }),
  body("clinicGrowerClinicName").optional({ nullable: true }).isString().trim().isLength({ max: 255 }),
  body("defaultOwnerUserId").optional({ nullable: true }).isUUID(),
  body("fallbackQueueLabel").optional({ nullable: true }).isString().trim().isLength({ max: 120 }),
  body("isActive").optional().isBoolean().toBoolean(),
];

export const updateClinicGrowerMappingValidator = [
  ...clinicGrowerMappingIdParamValidator,
  body("clientAccountProfileId").optional().isUUID().withMessage("A valid client account profile is required"),
  body("clinicGrowerClinicId").optional().isString().trim().isLength({ min: 1, max: 100 }),
  body("clinicGrowerClinicName").optional({ nullable: true }).isString().trim().isLength({ max: 255 }),
  body("defaultOwnerUserId").optional({ nullable: true }).isUUID(),
  body("fallbackQueueLabel").optional({ nullable: true }).isString().trim().isLength({ max: 120 }),
  body("isActive").optional().isBoolean().toBoolean(),
];
