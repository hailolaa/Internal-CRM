import { param } from "express-validator";

export const fleetEventIdParamValidator = [
  param("eventId").isUUID().withMessage("A valid event ID is required."),
];

export const fleetSyncExceptionParamValidator = [
  param("type").isIn(["freshness", "reconciliation"]).withMessage("A valid exception type is required."),
  param("exceptionId").isUUID().withMessage("A valid exception ID is required."),
];
