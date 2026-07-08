import { body, param } from "express-validator";

export const updateClinicProfileValidator = [
    body("name").optional().trim().notEmpty().withMessage("Clinic name can't be empty"),
    body("email").optional().isEmail().withMessage("Valid clinic email is required").normalizeEmail(),
    body("website").optional({ values: "falsy" }).isURL({ require_protocol: true }).withMessage("Valid clinic website URL is required"),
    body("phone").optional().trim(),
    body("address").optional().trim(),
    body("city").optional().trim(),
    body("state").optional().trim(),
    body("postalCode").optional().trim(),
    body("country").optional().trim(),
    body("timezone").optional().trim()
]


export const updatePatientProfileValidator = [
    param("contactId").isUUID().withMessage("valid contact ID is required"),
    body("firstName").optional().trim().notEmpty().withMessage("First name cannot be empty"),
    body("lastName").optional().trim().notEmpty().withMessage("Last name cannot be empty"),
    body("email").optional().isEmail().withMessage("Valid email is required").normalizeEmail(),
    body("phone").optional().trim(),
    body("dateOfBirth").optional().isISO8601().withMessage("Date of birth must be a valid date (YYYY-MM-DD)"),
    body("gender").optional().isIn(["MALE", "FEMALE", "OTHER"]),
    body("address").optional().trim(),
    body("city").optional().trim(),
    body("state").optional().trim(),
    body("postalCode").optional().trim(),
    body("country").optional().trim()
]
