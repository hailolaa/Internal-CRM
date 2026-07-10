import { body, param } from "express-validator";

const validRoles = ["ADMIN", "SALES", "DELIVERY", "FINANCE", "READ_ONLY"];

//Validation for the invite process
export const inviteMembersValidator = [
  body("emails")
    .isArray({ min: 1 })
    .withMessage("At least one email is required"),
  body("emails.*")
    .isEmail()
    .withMessage("Invalid email format")
    .normalizeEmail(),
  body("role")
    .isIn(validRoles)
    .withMessage(`Role must be one of: ${validRoles.join(", ")}`),
  body("personalMessage")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Personal message cannot exceed 500 characters"),
];

// Validation for updating a role
export const updateMemberRoleValidator = [
  param("userId").isUUID().withMessage("Invalid User ID format"),
  body("role")
    .isIn(validRoles)
    .withMessage(`Role must be one of: ${validRoles.join(", ")}`),
];

// Validation for removing a member
export const removeMemberValidator = [
  param("userId").isUUID().withMessage("Invalid User ID format"),
];

export const invitationIdParamValidator = [
  param("invitationId").isUUID().withMessage("Invalid invitation ID format"),
];

export const acceptInvitationValidator = [
  body("token").notEmpty().withMessage("Invitation token is required"),
  body("firstName").trim().notEmpty().withMessage("First name is required"),
  body("lastName").trim().notEmpty().withMessage("Last name is required"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/\d/)
    .withMessage("Password must contain at least one number")
    .matches(/[a-zA-Z]/)
    .withMessage("Password must contain at least one letter")
    .matches(/[^A-Za-z0-9]/)
    .withMessage("Password must contain at least one special character"),
];
