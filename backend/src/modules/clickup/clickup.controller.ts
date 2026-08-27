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

  receiveWebhook = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const receipt = await clickUpService.receiveWebhook(
        req.headers as Record<string, string | string[] | undefined>,
        req.body,
        (req as any).rawBody || null,
      );
      res.status(202).json({
        status: "success",
        data: receipt,
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

  listDeliveryProvisionFailures = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      res.status(200).json({
        status: "success",
        data: await clickUpService.listDeliveryProvisionFailures(user.clinicId),
      });
    } catch (error) {
      next(error);
    }
  };

  getClientDeliveryProvision = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      res.status(200).json({
        status: "success",
        data: await clickUpService.getClientDeliveryProvision(
          user.clinicId,
          String(req.params.clientAccountProfileId),
        ),
      });
    } catch (error) {
      next(error);
    }
  };

  retryDeliveryProvision = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      res.status(200).json({
        status: "success",
        data: await clickUpService.retryDeliveryProvision(
          user.clinicId,
          user.userId,
          String(req.params.provisionId),
        ),
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

  connectConfiguredApiToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      res.status(200).json({
        status: "success",
        data: await clickUpService.connectConfiguredApiToken(
          user.clinicId,
          user.userId,
          this.auditContext(req),
        ),
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

  listWorkspaces = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      res.status(200).json({
        status: "success",
        data: await clickUpService.listRemoteWorkspaces(user.clinicId),
      });
    } catch (error) {
      next(error);
    }
  };

  listSpaces = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      res.status(200).json({
        status: "success",
        data: await clickUpService.listRemoteSpaces(user.clinicId, req.query.workspaceId ? String(req.query.workspaceId) : null),
      });
    } catch (error) {
      next(error);
    }
  };

  listFolders = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      res.status(200).json({
        status: "success",
        data: await clickUpService.listRemoteFolders(
          user.clinicId,
          String(req.query.spaceId || ""),
          req.query.workspaceId ? String(req.query.workspaceId) : null,
        ),
      });
    } catch (error) {
      next(error);
    }
  };

  listLists = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      res.status(200).json({
        status: "success",
        data: await clickUpService.listRemoteLists(user.clinicId, {
          workspaceId: req.query.workspaceId ? String(req.query.workspaceId) : null,
          spaceId: req.query.spaceId ? String(req.query.spaceId) : null,
          folderId: req.query.folderId ? String(req.query.folderId) : null,
        }),
      });
    } catch (error) {
      next(error);
    }
  };

  listMembers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      res.status(200).json({
        status: "success",
        data: await clickUpService.listRemoteMembers(user.clinicId, req.query.workspaceId ? String(req.query.workspaceId) : null),
      });
    } catch (error) {
      next(error);
    }
  };

  getOperationsDashboard = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      res.status(200).json({
        status: "success",
        data: await clickUpService.getOperationsDashboard(user.clinicId),
      });
    } catch (error) {
      next(error);
    }
  };

  listCategoryMappings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      res.status(200).json({
        status: "success",
        data: await clickUpService.listCategoryMappings(
          user.clinicId,
          String(req.params.clientAccountProfileId),
          await this.accessContext(user),
        ),
      });
    } catch (error) {
      next(error);
    }
  };

  saveCategoryMapping = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      res.status(200).json({
        status: "success",
        data: await clickUpService.saveCategoryMapping(
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

  listPriorityMappings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      res.status(200).json({
        status: "success",
        data: await clickUpService.listPriorityMappings(user.clinicId),
      });
    } catch (error) {
      next(error);
    }
  };

  savePriorityMapping = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      res.status(200).json({
        status: "success",
        data: await clickUpService.savePriorityMapping(user.clinicId, user.userId, req.body, this.auditContext(req)),
      });
    } catch (error) {
      next(error);
    }
  };

  listFailedTaskMappings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      res.status(200).json({
        status: "success",
        data: await clickUpService.listFailedTaskMappings(user.clinicId),
      });
    } catch (error) {
      next(error);
    }
  };

  getReconciliationStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      res.status(200).json({
        status: "success",
        data: await clickUpService.getReconciliationStatus(user.clinicId),
      });
    } catch (error) {
      next(error);
    }
  };

  replayDeadLetterEvent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      res.status(200).json({
        status: "success",
        data: await clickUpService.replayDeadLetterEvent(user.clinicId, String(req.params.eventId)),
      });
    } catch (error) {
      next(error);
    }
  };

  runReconciliation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      res.status(200).json({
        status: "success",
        data: await clickUpService.runIncrementalReconciliation(50, user.clinicId),
      });
    } catch (error) {
      next(error);
    }
  };

  replayFailedTaskMapping = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      res.status(200).json({
        status: "success",
        data: await clickUpService.replayTaskMapping(
          user.clinicId,
          String(req.params.mappingId),
          user.userId,
          await this.accessContext(user),
          this.auditContext(req)
        ),
      });
    } catch (error) {
      next(error);
    }
  };

  dismissFailedTaskMapping = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      res.status(200).json({
        status: "success",
        data: await clickUpService.dismissTaskMapping(
          user.clinicId,
          String(req.params.mappingId),
          user.userId,
          this.auditContext(req)
        ),
      });
    } catch (error) {
      next(error);
    }
  };

  createClickUpTask = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const rawPayload = typeof req.body.payload === "string" ? JSON.parse(req.body.payload) : req.body;
      res.status(201).json({
        status: "success",
        data: await clickUpService.createClickUpTask(
          user.clinicId,
          user.userId,
          rawPayload,
          Array.isArray(req.files) ? req.files : [],
          await this.accessContext(user),
          this.auditContext(req),
        ),
      });
    } catch (error) {
      next(error);
    }
  };
}

export const clickUpController = new ClickUpController();
