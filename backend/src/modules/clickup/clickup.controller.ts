import { Request, Response, NextFunction } from "express";
import { userCanManageAllClientAccounts } from "../../middleware/authorize.js";
import { clickUpService } from "./clickup.service.js";

export class ClickUpController {
  private auditContext(req: Request) {
    return {
      ipAddress: req.ip || null,
      userAgent: req.get("user-agent") || null,
    };
  }

  private async accessContext(user: any) {
    return {
      canManageAllClientAccounts: await userCanManageAllClientAccounts(user.userId, user.clinicId),
    };
  }

  completeOAuthRedirect = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const connection = await clickUpService.completeOAuth(
        {
          code: String(req.query.code || ""),
          state: String(req.query.state || ""),
          workspaceId: req.query.workspaceId ? String(req.query.workspaceId) : null,
        },
        this.auditContext(req),
      );

      res.status(200).json({
        status: "success",
        data: connection,
      });
    } catch (error) {
      next(error);
    }
  };

  getStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      res.status(200).json({
        status: "success",
        data: await clickUpService.getStatus(user.clinicId),
      });
    } catch (error) {
      next(error);
    }
  };

  startOAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      res.status(200).json({
        status: "success",
        data: await clickUpService.startOAuth(user.clinicId, user.userId, this.auditContext(req)),
      });
    } catch (error) {
      next(error);
    }
  };

  completeOAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(200).json({
        status: "success",
        data: await clickUpService.completeOAuth(req.body, this.auditContext(req)),
      });
    } catch (error) {
      next(error);
    }
  };

  revoke = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      res.status(200).json({
        status: "success",
        data: await clickUpService.revoke(user.clinicId, user.userId, this.auditContext(req)),
      });
    } catch (error) {
      next(error);
    }
  };

  getClientMapping = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      res.status(200).json({
        status: "success",
        data: await clickUpService.getClientMapping(
          user.clinicId,
          String(req.params.clientAccountProfileId),
          await this.accessContext(user),
        ),
      });
    } catch (error) {
      next(error);
    }
  };

  saveClientMapping = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      res.status(200).json({
        status: "success",
        data: await clickUpService.saveClientMapping(
          user.clinicId,
          user.userId,
          String(req.params.clientAccountProfileId),
          req.body,
          await this.accessContext(user),
          this.auditContext(req),
        ),
      });
    } catch (error) {
      next(error);
    }
  };

  deleteClientMapping = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      res.status(200).json({
        status: "success",
        data: await clickUpService.deleteClientMapping(
          user.clinicId,
          user.userId,
          String(req.params.clientAccountProfileId),
          await this.accessContext(user),
          this.auditContext(req),
        ),
      });
    } catch (error) {
      next(error);
    }
  };

  saveTaskMapping = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      res.status(200).json({
        status: "success",
        data: await clickUpService.saveTaskMapping(
          user.clinicId,
          user.userId,
          req.body,
          await this.accessContext(user),
          this.auditContext(req),
        ),
      });
    } catch (error) {
      next(error);
    }
  };

  listTaskMappings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      res.status(200).json({
        status: "success",
        data: await clickUpService.listTaskMappings(
          user.clinicId,
          String(req.query.clientAccountProfileId),
          await this.accessContext(user),
        ),
      });
    } catch (error) {
      next(error);
    }
  };
}

export const clickUpController = new ClickUpController();
