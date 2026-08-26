import { body } from "express-validator";

const sourceSystems = ["clickup", "csv", "json"];

export const importClientOperatingRegisterValidator = [
  body("sourceSystem").optional().isIn(sourceSystems),
  body("sourceListId").optional({ nullable: true }).isString().trim().isLength({ max: 80 }),
  body("sourceVersion").optional({ nullable: true }).isString().trim().isLength({ max: 160 }),
  body("dryRun").optional().isBoolean().toBoolean(),
  body("markMissingSource").optional().isBoolean().toBoolean(),
  body("records").isArray({ min: 1, max: 500 }).withMessage("records must contain 1-500 register rows"),
  body("records.*.id").optional({ nullable: true }).isString().trim().isLength({ max: 80 }),
  body("records.*.name").optional({ nullable: true }).isString().trim().isLength({ max: 255 }),
  body("records.*.text_content").optional({ nullable: true }).isString().isLength({ max: 30000 }),
  body("records.*.markdown_description").optional({ nullable: true }).isString().isLength({ max: 30000 }),
  body("records.*.url").optional({ nullable: true }).isString().trim().isLength({ max: 500 }),
];
