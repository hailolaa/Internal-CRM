import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { competitorsController } from "./competitors.controller.js";
import { competitorIdParamValidator, createCompetitorValidator, updateCompetitorValidator } from "./competitors.validators.js";

const router = Router();

router.use(authenticate);

// @route   GET /api/competitors
// @desc    List competitor records
// @access  Private
router.get("/", authorizePermission("marketing:read"), competitorsController.listCompetitors);

// @route   POST /api/competitors
// @desc    Create competitor record
// @access  Private
router.post("/", authorizePermission("marketing:write"), createCompetitorValidator, validate, competitorsController.createCompetitor);

// @route   PATCH /api/competitors/:id
// @desc    Update competitor record
// @access  Private
router.patch("/:id", authorizePermission("marketing:write"), updateCompetitorValidator, validate, competitorsController.updateCompetitor);

// @route   DELETE /api/competitors/:id
// @desc    Soft delete competitor record
// @access  Private
router.delete("/:id", authorizePermission("marketing:write"), competitorIdParamValidator, validate, competitorsController.deleteCompetitor);

export default router;

