import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { treatmentPlansController } from "./treatment-plans.controller.js";
import { createTreatmentPlanValidator, treatmentPlanIdParamValidator, updateTreatmentPlanValidator } from "./treatment-plans.validators.js";

const router = Router();

router.use(authenticate);

// @route   GET /api/treatment-plans
// @desc    List treatment plans
// @access  Private
router.get("/", authorizePermission("reports:read"), treatmentPlansController.listTreatmentPlans);

// @route   POST /api/treatment-plans
// @desc    Create treatment plan
// @access  Private
router.post("/", authorizePermission("reports:write"), createTreatmentPlanValidator, validate, treatmentPlansController.createTreatmentPlan);

// @route   PATCH /api/treatment-plans/:id
// @desc    Update treatment plan
// @access  Private
router.patch("/:id", authorizePermission("reports:write"), updateTreatmentPlanValidator, validate, treatmentPlansController.updateTreatmentPlan);

// @route   DELETE /api/treatment-plans/:id
// @desc    Soft delete treatment plan
// @access  Private
router.delete("/:id", authorizePermission("reports:write"), treatmentPlanIdParamValidator, validate, treatmentPlansController.deleteTreatmentPlan);

export default router;

