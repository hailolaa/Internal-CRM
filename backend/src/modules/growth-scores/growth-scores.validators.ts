import { body, query } from "express-validator";

const scoreCategoryFields = [
  "websiteVisibility",
  "seo",
  "gbp",
  "tracking",
  "conversion",
  "leadHandling",
  "responseSpeed",
  "enquiryVisibility",
  "treatmentPerformance",
  "revenueLeakage",
  "growthOpportunity",
];

const scoreField = (path: string) =>
  body(path).optional({ nullable: true }).isFloat({ min: 0, max: 100 }).toFloat();

export const createGrowthScoreSnapshotValidator = [
  body("contactId").optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
  body("clientAccountProfileId").optional({ nullable: true }).isUUID(),
  body("auditId").optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
  body("snapshotDate").optional({ nullable: true, checkFalsy: true }).isISO8601(),
  body("scoredAt").optional({ nullable: true, checkFalsy: true }).isISO8601(),
  scoreField("overallScore"),
  scoreField("overall"),
  body("categoryScores").optional({ nullable: true }).isObject(),
  body("categories").optional({ nullable: true }).isObject(),
  ...scoreCategoryFields.flatMap((field) => [
    scoreField(`categoryScores.${field}`),
    scoreField(`categories.${field}`),
  ]),
  body("recommendedPackage").optional({ nullable: true }).isString().trim().isLength({ max: 150 }),
  body("gapSummary").optional({ nullable: true }).isString().trim().isLength({ max: 5000 }),
  body("source").optional({ nullable: true }).isString().trim().isLength({ max: 80 }),
  body("notes").optional({ nullable: true }).isString().trim().isLength({ max: 5000 }),
  body().custom((value) => {
    if (value.contactId || value.clientAccountProfileId || value.auditId) return true;
    throw new Error("Snapshot must be linked to a lead/contact, client account, or audit");
  }),
];

export const listGrowthScoreSnapshotsValidator = [
  query("contactId").optional().isString().trim().isLength({ max: 100 }),
  query("clientAccountProfileId").optional().isUUID(),
  query("auditId").optional().isString().trim().isLength({ max: 100 }),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  query().custom((value) => {
    if (value.contactId || value.clientAccountProfileId || value.auditId) return true;
    throw new Error("Provide contactId, clientAccountProfileId, or auditId");
  }),
];
