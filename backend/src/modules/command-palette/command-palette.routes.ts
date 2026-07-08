import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { commandPaletteController } from "./command-palette.controller.js";
import { commandPaletteQueryValidator } from "./command-palette.validators.js";

const router = Router();

router.use(authenticate);

// @route   GET /api/command-palette
// @desc    Permission-aware command palette actions, records, and clinic switch targets
// @access  Private
router.get(
  "/",
  commandPaletteQueryValidator,
  validate,
  commandPaletteController.getCommandPalette,
);

export default router;
