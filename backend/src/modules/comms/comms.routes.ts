import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { commsController } from "./comms.controller.js";
import { contactIdParamValidator } from "../contacts/contacts.validators.js";
import {
  listInboxValidator,
  sendMessageValidator,
  updateArchiveStateValidator,
  updateWhatsAppAiSettingsValidator,
  whatsAppApproveValidator,
  whatsAppDraftValidator,
  whatsAppInboundValidator,
  whatsAppRetryValidator,
  updateReadStateValidator,
  updateStarStateValidator,
} from "./comms.validators.js";

const router = Router();

router.use(authenticate);

// @route   GET /api/comms/inbox
// @desc    List unified email and SMS inbox items
// @access  Private
router.get(
  "/inbox",
  authorizePermission("calls:read"),
  listInboxValidator,
  validate,
  commsController.listInbox,
);

// @route   PATCH /api/comms/inbox/read-all
// @desc    Mark all active inbox conversations read
// @access  Private
router.patch(
  "/inbox/read-all",
  authorizePermission("calls:write"),
  commsController.markAllRead,
);

// @route   PATCH /api/comms/inbox/:id/read
// @desc    Mark one conversation read or unread
// @access  Private
router.patch(
  "/inbox/:id/read",
  authorizePermission("calls:write"),
  contactIdParamValidator,
  updateReadStateValidator,
  validate,
  commsController.updateReadState,
);

// @route   PATCH /api/comms/inbox/:id/star
// @desc    Star or unstar one conversation
// @access  Private
router.patch(
  "/inbox/:id/star",
  authorizePermission("calls:write"),
  contactIdParamValidator,
  updateStarStateValidator,
  validate,
  commsController.updateStarState,
);

// @route   PATCH /api/comms/inbox/:id/archive
// @desc    Archive or unarchive one conversation
// @access  Private
router.patch(
  "/inbox/:id/archive",
  authorizePermission("calls:write"),
  contactIdParamValidator,
  updateArchiveStateValidator,
  validate,
  commsController.updateArchiveState,
);

// @route   GET /api/comms/inbox/:id
// @desc    Get a single conversation thread for one contact
// @access  Private
router.get(
	"/inbox/:id",
	authorizePermission("calls:read"),
	contactIdParamValidator,
	validate,
	commsController.getConversation,
);

// @route   POST /api/comms/inbox/:id/messages
// @desc    Send an outbound email or SMS reply in a conversation
// @access  Private
router.post(
	"/inbox/:id/messages",
	authorizePermission("calls:write"),
	contactIdParamValidator,
	sendMessageValidator,
	validate,
	commsController.sendMessage,
);

router.get(
  "/whatsapp-ai/settings",
  authorizePermission("settings:read"),
  commsController.getWhatsAppAiSettings,
);

router.put(
  "/whatsapp-ai/settings",
  authorizePermission("settings:write"),
  updateWhatsAppAiSettingsValidator,
  validate,
  commsController.updateWhatsAppAiSettings,
);

router.post(
  "/whatsapp/inbound",
  authorizePermission("contacts:write"),
  whatsAppInboundValidator,
  validate,
  commsController.ingestWhatsAppInbound,
);

router.get(
  "/whatsapp/conversations/:id",
  authorizePermission("calls:read"),
  contactIdParamValidator,
  validate,
  commsController.getWhatsAppConversation,
);

router.post(
  "/whatsapp/ai-replies/draft",
  authorizePermission("contacts:write"),
  whatsAppDraftValidator,
  validate,
  commsController.draftWhatsAppReply,
);

router.post(
  "/whatsapp/ai-replies/:replyId/approve",
  authorizePermission("contacts:write"),
  whatsAppApproveValidator,
  validate,
  commsController.approveWhatsAppReply,
);

router.post(
  "/whatsapp/ai-replies/:replyId/retry",
  authorizePermission("contacts:write"),
  whatsAppRetryValidator,
  validate,
  commsController.retryWhatsAppReply,
);

export default router;
