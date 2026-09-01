import { body, param } from "express-validator";

const hash = /^[a-fA-F0-9]{64}$/;

export const serviceAgreementIdParamValidator = [
  param("id").isUUID().withMessage("Invalid service agreement ID format"),
];

export const generateServiceAgreementValidator = [
  body("sourceType").isIn(["accepted_proposal", "manual_entry", "transcript_draft"]).withMessage("Unsupported sourceType"),
  body("sourceReference").optional({ nullable: true }).isString().trim().notEmpty().isLength({ max: 191 }),
  body("proposalId").optional({ nullable: true }).isUUID().withMessage("Invalid proposalId"),
  body("clientAccountProfileId").optional({ nullable: true }).isUUID().withMessage("Invalid clientAccountProfileId"),
  body("renderMode").optional({ nullable: true }).isIn(["test_do_not_send", "production"]).withMessage("Unsupported renderMode"),
  body("legalTermsVersion").isString().trim().notEmpty().isLength({ max: 120 }).withMessage("legalTermsVersion is required"),
  body("legalContentSha256").matches(hash).withMessage("legalContentSha256 must be a sha256 hash"),
  body("templateVersion").isString().trim().notEmpty().isLength({ max: 120 }).withMessage("templateVersion is required"),
  body("templateSha256").matches(hash).withMessage("templateSha256 must be a sha256 hash"),
  body("cssSha256").matches(hash).withMessage("cssSha256 must be a sha256 hash"),
  body("assetManifestSha256").matches(hash).withMessage("assetManifestSha256 must be a sha256 hash"),
  body("assetPaths").optional().isArray().withMessage("assetPaths must be an array"),
  body("assetPaths.*").optional().isString().trim().notEmpty().isLength({ max: 500 }),
  body("commercialTerms").optional().isObject().withMessage("commercialTerms must be an object"),
];

export const attachSignatureEvidenceValidator = [
  ...serviceAgreementIdParamValidator,
  body("signatureEvidenceId").isUUID().withMessage("Invalid signatureEvidenceId"),
  body("acceptedPdfSha256").matches(hash).withMessage("acceptedPdfSha256 must be a sha256 hash"),
];

export const unlockOnboardingValidator = [
  ...serviceAgreementIdParamValidator,
  body("paymentStatus").equals("paid").withMessage("paymentStatus must be paid"),
  body("authenticated").isBoolean().custom((value) => value === true).withMessage("authenticated payment evidence is required"),
  body("clearedAt").isISO8601().withMessage("clearedAt must be a valid date"),
];
