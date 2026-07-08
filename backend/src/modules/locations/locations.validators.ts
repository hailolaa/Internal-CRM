import { body, param } from "express-validator";

// Validation for creating a new location
export const createLocationValidator = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Location name is required")
    .isLength({ max: 255 }),
  body("address")
    .trim()
    .notEmpty()
    .withMessage("Physical address is required"),
  body("city").optional().trim(),
  body("state").optional().trim(),
  body("postalCode").optional().trim(),
  body("country").optional().trim(),
  body("phone").optional().trim(),
  body("email").optional().isEmail().withMessage("Invalid email format").normalizeEmail(),
  body("roomCount")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Room count must be 0 or greater"),
  body("workingHours")
    .optional()
    .isObject()
    .withMessage("Working hours must be a valid JSON object"),
  body("isPrimary").optional().isBoolean(),
  body("status")
    .optional()
    .isIn(["active", "inactive", "coming_soon"])
    .withMessage("Status must be: active, inactive, or coming_soon"),
];

// Validation for updating an existing location
export const updateLocationValidator = [
  param("id").isUUID().withMessage("Invalid Location ID format"),
  ...createLocationValidator.map(v => v.optional())
];

// Simple ID validation for GET or DELETE
export const locationIdParamValidator = [
  param("id").isUUID().withMessage("Invalid Location ID format"),
];
