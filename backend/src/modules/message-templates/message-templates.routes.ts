import { Router } from "express";
import { messageTemplatesController } from "./message-templates.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import {
  createMessageTemplateValidator,
  listMessageTemplatesValidator,
  messageTemplateIdParamValidator,
  testSendMessageTemplateValidator,
  updateMessageTemplateValidator,
} from "./message-templates.validators.js";

const router = Router();

router.use(authenticate);

// @route   GET /api/message-templates
// @desc    List message templates
// @access  Private
router.get("/", authorizePermission("marketing:read"), listMessageTemplatesValidator, validate, messageTemplatesController.listTemplates);

// @route   GET /api/message-templates/:id
// @desc    Get a single message template
// @access  Private
router.get("/:id", authorizePermission("marketing:read"), messageTemplateIdParamValidator, validate, messageTemplatesController.getTemplate);

// @route   POST /api/message-templates
// @desc    Create a message template
// @access  Private
router.post("/", authorizePermission("marketing:write"), createMessageTemplateValidator, validate, messageTemplatesController.createTemplate);

// @route   POST /api/message-templates/:id/test-send
// @desc    Send or queue a test message template delivery
// @access  Private
router.post("/:id/test-send", authorizePermission("marketing:write"), testSendMessageTemplateValidator, validate, messageTemplatesController.testSendTemplate);

// @route   PATCH /api/message-templates/:id
// @desc    Update a message template
// @access  Private
router.patch("/:id", authorizePermission("marketing:write"), updateMessageTemplateValidator, validate, messageTemplatesController.updateTemplate);

// @route   PATCH /api/message-templates/:id/archive
// @desc    Archive a message template
// @access  Private
router.patch("/:id/archive", authorizePermission("marketing:write"), messageTemplateIdParamValidator, validate, messageTemplatesController.archiveTemplate);

// @route   DELETE /api/message-templates/:id
// @desc    Soft delete a message template
// @access  Private
router.delete("/:id", authorizePermission("marketing:write"), messageTemplateIdParamValidator, validate, messageTemplatesController.deleteTemplate);

export default router;
