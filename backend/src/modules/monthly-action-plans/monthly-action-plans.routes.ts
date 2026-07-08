import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { monthlyActionPlansController } from "./monthly-action-plans.controller.js";
import {
  generateMonthlyActionPlanValidator,
  getMonthlyActionPlanValidator,
  updateMonthlyActionPlanItemStatusValidator,
  updateMonthlyActionPlanStatusValidator,
} from "./monthly-action-plans.validators.js";

const router = Router();

router.use(authenticate);

// @route   GET /api/monthly-action-plans
// @desc    Get a monthly action plan by month
// @access  Private
router.get("/", authorizePermission("reports:read"), getMonthlyActionPlanValidator, validate, monthlyActionPlansController.getPlan);

// @route   POST /api/monthly-action-plans/generate
// @desc    Generate or refresh a monthly action plan
// @access  Private
router.post(
  "/generate",
  authorizePermission("reports:write"),
  generateMonthlyActionPlanValidator,
  validate,
  monthlyActionPlansController.generatePlan,
);

// @route   PATCH /api/monthly-action-plans/:id/status
// @desc    Update monthly action plan status
// @access  Private
router.patch(
  "/:id/status",
  authorizePermission("reports:write"),
  updateMonthlyActionPlanStatusValidator,
  validate,
  monthlyActionPlansController.updatePlanStatus,
);

// @route   PATCH /api/monthly-action-plans/:planId/items/:itemId/status
// @desc    Update monthly action plan item status
// @access  Private
router.patch(
  "/:planId/items/:itemId/status",
  authorizePermission("reports:write"),
  updateMonthlyActionPlanItemStatusValidator,
  validate,
  monthlyActionPlansController.updateItemStatus,
);

export default router;
