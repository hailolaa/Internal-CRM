import { query } from "express-validator";

export const commandPaletteQueryValidator = [
  query("query").optional().isString().trim().isLength({ max: 255 }),
  query("limit").optional().isInt({ min: 1, max: 25 }).toInt(),
  query("includeDisabled").optional().isBoolean().toBoolean(),
];
