import { Router } from "express";
import { teamController } from "./team.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { authRateLimit } from "../../middleware/rateLimit.js";
import {
  acceptInvitationValidator,
  invitationIdParamValidator,
  inviteMembersValidator,
  updateMemberRoleValidator,
  removeMemberValidator,
} from "./team.validators.js";

const router = Router();

// @route   POST /api/team/invite/accept
// @desc    Accept a pending team invitation and create the invited account
// @access  Public
router.post(
  "/invite/accept",
  authRateLimit,
  acceptInvitationValidator,
  validate,
  teamController.acceptInvitation
);

// All team routes require authentication
router.use(authenticate);


// @route   POST /api/team/invite
// @desc    Invite new team members
// @access  Private (Super Admin Only)
 
router.post(
  "/invite",
  authorize("SUPER_ADMIN"),
  inviteMembersValidator,
  validate,
  teamController.inviteMembers
);

// @route   POST /api/team/invitations/:invitationId/resend
// @desc    Resend a pending invitation
// @access  Private (Super Admin Only)
router.post(
  "/invitations/:invitationId/resend",
  authorize("SUPER_ADMIN"),
  invitationIdParamValidator,
  validate,
  teamController.resendInvitation
);

// @route   DELETE /api/team/invitations/:invitationId
// @desc    Cancel a pending invitation
// @access  Private (Super Admin Only)
router.delete(
  "/invitations/:invitationId",
  authorize("SUPER_ADMIN"),
  invitationIdParamValidator,
  validate,
  teamController.cancelInvitation
);


// @route   GET /api/team/members
// @desc    Get all team members and pending invites
// @access  Private (Admin / Super Admin)
router.get(
  "/members",
  authorize("SUPER_ADMIN", "ADMIN"),
  teamController.getTeamMembers
);


// @route   DELETE /api/team/members/:userId
// @desc    Remove a member from the clinic
// @access  Private (Super Admin Only)
router.delete(
  "/members/:userId",
  authorize("SUPER_ADMIN"),
  removeMemberValidator,
  validate,
  teamController.removeMember
);


// @route   PATCH /api/team/members/:userId/role
// @desc    Change a member's role
// @access  Private (Super Admin Only)
router.patch(
  "/members/:userId/role",
  authorize("SUPER_ADMIN"),
  updateMemberRoleValidator,
  validate,
  teamController.updateMemberRole
);

export default router;
