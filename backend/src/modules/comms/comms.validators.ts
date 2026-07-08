import { body, query } from "express-validator";

export const listInboxValidator = [
  query("archived").optional({ checkFalsy: true }).isIn(["false", "true", "only", "with"]),
];

export const sendMessageValidator = [
  body("channel").optional().isIn(["email", "sms"]),
  body("body").trim().notEmpty().withMessage("Message body is required").isLength({ max: 5000 }),
  body("subject").optional({ nullable: true }).trim().isLength({ max: 500 }),
];

export const updateReadStateValidator = [
  body("unread").isBoolean().toBoolean(),
];

export const updateStarStateValidator = [
  body("starred").isBoolean().toBoolean(),
];

export const updateArchiveStateValidator = [
  body("archived").isBoolean().toBoolean(),
];
