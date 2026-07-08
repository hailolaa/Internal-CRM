import { Request, Response, NextFunction } from "express";
import { teamService } from "./team.service.js";

function getRequestMeta(req: Request) {
  return {
    ipAddress: req.ip || null,
    userAgent: req.get("user-agent") || null,
  };
}

export class TeamController {
  acceptInvitation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await teamService.acceptInvitation(req.body, getRequestMeta(req));
      res.status(200).json({
        status: "success",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  
  // POST /api/team/invite
  // Send bulk invitations to new members
  inviteMembers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId: invitedBy } = (req as any).user;
      await teamService.inviteMembers(clinicId, invitedBy, req.body, getRequestMeta(req));
      res.status(201).json({
        status: "success",
        message: "Invitations processed successfully",
      });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/team/invitations/:invitationId/resend
  // Resend a pending invitation email
  resendInvitation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await teamService.resendInvitation(
        clinicId,
        userId,
        req.params.invitationId as string,
      );
      res.status(200).json({
        status: "success",
        message: "Invitation resent successfully",
      });
    } catch (error) {
      next(error);
    }
  };

  // DELETE /api/team/invitations/:invitationId
  // Cancel a pending invitation
  cancelInvitation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await teamService.cancelInvitation(
        clinicId,
        userId,
        req.params.invitationId as string,
      );
      res.status(200).json({
        status: "success",
        message: "Invitation cancelled successfully",
      });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/team/members
  // List all users and pending invites in the clinic
  getTeamMembers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const members = await teamService.getTeamMembers(clinicId);
      res.status(200).json({
        status: "success",
        data: members,
      });
    } catch (error) {
      next(error);
    }
  };

  
  // DELETE /api/team/members/:userId
  // Remove a member from the clinic
   
  removeMember = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId: actorUserId } = (req as any).user;
      const userId = req.params.userId as string;
      await teamService.removeMember(clinicId, actorUserId, userId, getRequestMeta(req));
      res.status(200).json({
        status: "success",
        message: "Team member removed successfully",
      });
    } catch (error) {
      next(error);
    }
  };

  
  // PATCH /api/team/members/:userId/role
  // Update a member's role
  
  updateMemberRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId: actorUserId } = (req as any).user;
      const userId = req.params.userId as string;
      const { role } = req.body;
      await teamService.updateMemberRole(
        clinicId,
        actorUserId,
        userId,
        role,
        getRequestMeta(req),
      );
      res.status(200).json({
        status: "success",
        message: "Member role updated successfully",
      });
    } catch (error) {
      next(error);
    }
  };
}

export const teamController = new TeamController();
