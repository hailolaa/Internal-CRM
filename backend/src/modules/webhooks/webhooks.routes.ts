import { Router } from "express";
import { webhooksController } from "./webhooks.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { createWebhookEndpointValidator, updateWebhookEndpointValidator, webhookEndpointIdParamValidator } from "./webhooks.validators.js";

const router = Router();

// @route   POST /api/webhooks/twilio/calls
// @desc    Public Twilio call status webhook
// @access  Public provider webhook
router.post("/twilio/calls", webhooksController.handleTwilioCall);

// @route   POST /api/webhooks/twilio/recordings
// @desc    Public Twilio recording webhook
// @access  Public provider webhook
router.post("/twilio/recordings", webhooksController.handleTwilioRecording);

router.use(authenticate);

// @route   GET /api/webhooks/endpoints
// @desc    List webhook endpoints
// @access  Private
router.get("/endpoints", authorizePermission("webhooks:read"), webhooksController.listEndpoints);

// @route   POST /api/webhooks/endpoints
// @desc    Create a webhook endpoint
// @access  Private
router.post("/endpoints", authorizePermission("webhooks:write"), createWebhookEndpointValidator, validate, webhooksController.createEndpoint);

// @route   PATCH /api/webhooks/endpoints/:id
// @desc    Update a webhook endpoint
// @access  Private
router.patch("/endpoints/:id", authorizePermission("webhooks:write"), updateWebhookEndpointValidator, validate, webhooksController.updateEndpoint);

// @route   DELETE /api/webhooks/endpoints/:id
// @desc    Soft delete a webhook endpoint
// @access  Private
router.delete("/endpoints/:id", authorizePermission("webhooks:write"), webhookEndpointIdParamValidator, validate, webhooksController.deleteEndpoint);

export default router;
