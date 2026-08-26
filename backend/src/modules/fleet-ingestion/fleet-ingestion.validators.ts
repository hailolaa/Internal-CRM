import { body, param } from "express-validator";

export const fleetEventIdParamValidator = [
  param("eventId").isUUID().withMessage("A valid event ID is required."),
];

export const fleetSyncExceptionParamValidator = [
  param("type").isIn(["freshness", "reconciliation"]).withMessage("A valid exception type is required."),
  param("exceptionId").isUUID().withMessage("A valid exception ID is required."),
];

export const fleetSyncExceptionActionValidator = [
  ...fleetSyncExceptionParamValidator,
  body("reason").optional({ nullable: true }).isString().trim().isLength({ max: 1000 }),
];
