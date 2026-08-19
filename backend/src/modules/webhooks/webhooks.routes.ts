import { Router } from "express";
import { webhooksController } from "./webhooks.controller.js";
import { proposalsController } from "../proposals/proposals.controller.js";
import { missedCallRecoveryController } from "../missed-call-recovery/missed-call-recovery.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { createWebhookEndpointValidator, updateWebhookEndpointValidator, webhookEndpointIdParamValidator } from "./webhooks.validators.js";
import { proposalSignatureWebhookProviderValidator } from "../proposals/proposals.validators.js";

const router = Router();

// @route   POST /api/webhooks/twilio/calls
// @desc    Public Twilio call status webhook
// @access  Public provider webhook
router.post("/twilio/calls", webhooksController.handleTwilioCall);

// @route   POST /api/webhooks/twilio/recordings
// @desc    Public Twilio recording webhook
// @access  Public provider webhook
router.post("/twilio/recordings", webhooksController.handleTwilioRecording);

// @route   GET /api/webhooks/whatsapp/inbound
// @desc    Public Meta WhatsApp webhook verification handshake
// @access  Public provider webhook
router.get("/whatsapp/inbound", webhooksController.handleWhatsAppVerify);

// @route   POST /api/webhooks/whatsapp/inbound
// @desc    Public Meta or Twilio WhatsApp inbound lead message webhook
// @access  Public provider webhook
router.post("/whatsapp/inbound", webhooksController.handleWhatsAppInbound);

// @route   POST /api/webhooks/email/inbound
// @desc    Public inbound email webhook for Mission Control inbox
// @access  Public provider webhook
router.post("/email/inbound", webhooksController.handleEmailInbound);

// @route   POST /api/webhooks/esign/:provider
// @desc    Public e-sign provider status/evidence callback
// @access  Public provider webhook
router.post(
  "/esign/:provider",
  proposalSignatureWebhookProviderValidator,
  validate,
  proposalsController.handleSignatureWebhook,
);

// @route   POST /api/webhooks/clinicgrower/missed-call-recovery
// @desc    Signed ClinicGrower missed-call recovery event intake
// @access  Public server-to-server provider webhook
router.post(
  "/clinicgrower/missed-call-recovery",
  missedCallRecoveryController.handleClinicGrowerEvent,
);

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
