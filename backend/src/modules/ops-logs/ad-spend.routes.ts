import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { opsLogsController } from "./ops-logs.controller.js";
import {
  createSpendValidator,
  opsLogIdParamValidator,
  updateSpendValidator,
} from "./ops-logs.validators.js";

const router = Router();

router.use(authenticate);

// @route   GET /api/ad-spend
// @desc    List manual ad spend entries
// @access  Private
router.get("/", authorizePermission("reports:read"), opsLogsController.listSpend);

// @route   POST /api/ad-spend
// @desc    Create manual ad spend entry
// @access  Private
router.post("/", authorizePermission("reports:write"), createSpendValidator, validate, opsLogsController.createSpend);

// @route   PATCH /api/ad-spend/:id
// @desc    Update manual ad spend entry
// @access  Private
router.patch("/:id", authorizePermission("reports:write"), updateSpendValidator, validate, opsLogsController.updateSpend);

// @route   DELETE /api/ad-spend/:id
// @desc    Soft delete manual ad spend entry
// @access  Private
router.delete("/:id", authorizePermission("reports:write"), opsLogIdParamValidator, validate, opsLogsController.deleteSpend);

export default router;
