import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { opsLogsController } from "./ops-logs.controller.js";
import {
  createConsultValidator,
  createSpendValidator,
  opsLogIdParamValidator,
  updateSpendValidator,
} from "./ops-logs.validators.js";

const router = Router();

router.use(authenticate);

// @route   GET /api/ops-logs/spend
// @desc    List manual ad spend entries
// @access  Private
router.get("/spend", authorizePermission("reports:read"), opsLogsController.listSpend);

// @route   POST /api/ops-logs/spend
// @desc    Create manual ad spend entry
// @access  Private
router.post("/spend", authorizePermission("reports:write"), createSpendValidator, validate, opsLogsController.createSpend);

// @route   PATCH /api/ops-logs/spend/:id
// @desc    Update manual ad spend entry
// @access  Private
router.patch("/spend/:id", authorizePermission("reports:write"), updateSpendValidator, validate, opsLogsController.updateSpend);

// @route   DELETE /api/ops-logs/spend/:id
// @desc    Soft delete manual ad spend entry
// @access  Private
router.delete("/spend/:id", authorizePermission("reports:write"), opsLogIdParamValidator, validate, opsLogsController.deleteSpend);

// @route   GET /api/ops-logs/consults
// @desc    List manual consult entries
// @access  Private
router.get("/consults", authorizePermission("reports:read"), opsLogsController.listConsults);

// @route   POST /api/ops-logs/consults
// @desc    Create manual consult entry
// @access  Private
router.post("/consults", authorizePermission("reports:write"), createConsultValidator, validate, opsLogsController.createConsult);

// @route   DELETE /api/ops-logs/consults/:id
// @desc    Soft delete manual consult entry
// @access  Private
router.delete("/consults/:id", authorizePermission("reports:write"), opsLogIdParamValidator, validate, opsLogsController.deleteConsult);

export default router;
