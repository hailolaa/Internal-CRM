import { body, param, query } from "express-validator";

export const listCalendarMeetingsValidator = [
  query("contactId").optional().isUUID(),
  query("clientAccountProfileId").optional().isUUID(),
  query("taskId").optional().isUUID(),
  query("upcoming").optional().isBoolean(),
  query("limit").optional().isInt({ min: 1, max: 100 }),
];

export const calendarMeetingIdParamValidator = [
  param("id").isUUID().withMessage("A valid calendar meeting id is required"),
];

export const updateCalendarMeetingLinksValidator = [
  ...calendarMeetingIdParamValidator,
  body("contactId").optional({ nullable: true }).isUUID(),
  body("clientAccountProfileId").optional({ nullable: true }).isUUID(),
  body("taskId").optional({ nullable: true }).isUUID(),
];
