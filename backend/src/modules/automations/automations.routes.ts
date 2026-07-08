import { Router } from "express";
import { automationsController } from "./automations.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { automationIdParamValidator, createAutomationValidator, updateAutomationValidator } from "./automations.validators.js";

const router = Router();

router.use(authenticate);

// @route   GET /api/automations
// @desc    List clinic automations
// @access  Private
router.get("/", authorizePermission("events:read"), automationsController.listAutomations);

// @route   POST /api/automations
// @desc    Create an automation
// @access  Private
router.post("/", authorizePermission("events:write"), createAutomationValidator, validate, automationsController.createAutomation);

// @route   PATCH /api/automations/:id
// @desc    Update an automation
// @access  Private
router.patch("/:id", authorizePermission("events:write"), updateAutomationValidator, validate, automationsController.updateAutomation);

// @route   DELETE /api/automations/:id
// @desc    Soft delete an automation
// @access  Private
router.delete("/:id", authorizePermission("events:write"), automationIdParamValidator, validate, automationsController.deleteAutomation);

export default router;
