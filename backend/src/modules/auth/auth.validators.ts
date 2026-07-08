import { body, param } from "express-validator";

export const registerClinicValidator = [
    body("clinicName").trim().notEmpty().withMessage("Clinic name is required"),
    body("adminEmail").isEmail().withMessage("Valid admin email is required").normalizeEmail(),
    body("adminPassword").isLength({ min: 8 }).withMessage("Password must be at least 8 characters long").matches(/\d/).withMessage("Password must contain at least one number").matches(/[a-zA-Z]/).withMessage("Password must contain at least one letter").matches(/[^A-Za-z0-9]/).withMessage("Password must contain at least one special character"),
    body("firstName").trim().notEmpty().withMessage("First name is required"),
    body("lastName").trim().notEmpty().withMessage("Last name is required"),
    body("phone").optional().trim()
];

export const registerPatientValidator = [
    body("clinicId").trim().notEmpty().withMessage("Valid Clinic ID is required"),
    body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
    body("password").optional().isLength({ min: 8 }).withMessage("Password must be at least 8 characters long").matches(/\d/).withMessage("Password must contain at least one number").matches(/[a-zA-Z]/).withMessage("Password must contain at least one letter").matches(/[^A-Za-z0-9]/).withMessage("Password must contain at least one special character"),
    body("firstName").trim().notEmpty().withMessage("First name is required"),
    body("lastName").trim().notEmpty().withMessage("Last name is required"),
    body("phone").optional().trim()
];


export const loginValidator = [
    body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
    body("password").notEmpty().withMessage("Password is required"),
    body("rememberMe").optional().isBoolean().withMessage("rememberMe must be a boolean"),
];


export const verify2faValidator = [
    body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
    body("code").isLength({ min: 6 }).withMessage("2FA code must be 6 digits"),
    body("rememberMe").optional().isBoolean().withMessage("rememberMe must be a boolean"),
];


export const forgotPasswordValidator = [
    body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
];


export const resetPasswordValidator = [
    body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
    body("token").notEmpty().withMessage("Reset token is required"),
    body("newPassword").isLength({ min: 8 }).withMessage("New password must be at least 8 characters long").matches(/\d/).withMessage("New password must contain at least one number").matches(/[a-zA-Z]/).withMessage("New password must contain at least one letter").matches(/[^A-Za-z0-9]/).withMessage("New password must contain at least one special character"),
];

export const verifyEmailValidator = [
    body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
    body("token").notEmpty().withMessage("Verification token is required"),
];

export const resendVerificationEmailValidator = [
    body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
];

export const refreshTokenValidator = [
    body("refreshToken").notEmpty().withMessage("Refresh token is required"),
];

export const logoutValidator = [
    body("refreshToken").optional().isString().withMessage("Refresh token must be a string"),
];

export const revokeSessionValidator = [
    param("sessionId").isUUID().withMessage("Valid session id is required"),
];

export const switchClinicValidator = [
    body("clinicId").trim().notEmpty().withMessage("Clinic ID is required"),
    body("refreshToken").optional().isString().withMessage("Refresh token must be a string"),
    body("rememberMe").optional().isBoolean().withMessage("rememberMe must be a boolean"),
];
