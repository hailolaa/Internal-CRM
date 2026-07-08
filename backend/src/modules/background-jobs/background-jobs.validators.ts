import { body, param } from "express-validator";

export const updateBackgroundJobStatusValidator = [
  param("id").isString().trim().isLength({ min: 1, max: 100 }),
  body("status").isIn(["active", "paused"]).withMessage("Status must be active or paused"),
];
