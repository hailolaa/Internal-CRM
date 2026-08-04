import { Request, Response, NextFunction } from "express";
import { config } from "../../config/index.js";
import { quickBooksService } from "./quickbooks.service.js";

export class QuickBooksController {
  private auditContext(req: Request) {
    return {
      ipAddress: req.ip || null,
      userAgent: req.get("user-agent") || null,
    };
  }

  completeOAuthRedirect = async (req: Request, res: Response) => {
    const frontendUrl = config.frontendUrl.replace(/\/$/, "");
    try {
      await quickBooksService.completeOAuth(
        String(req.query.code || ""),
        String(req.query.state || ""),
        String(req.query.realmId || ""),
        this.auditContext(req),
      );
      res.redirect(`${frontendUrl}/app/integrations?quickbooks=connected`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "QuickBooks could not be connected.";
      const params = new URLSearchParams({ quickbooks: "error", message });
      res.redirect(`${frontendUrl}/app/integrations?${params.toString()}`);
    }
  };

  getStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      res.status(200).json({
        status: "success",
        data: await quickBooksService.getStatus(user.clinicId),
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
        data: { authorizeUrl: quickBooksService.getAuthorizationUrl(user.clinicId, user.userId) },
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
        data: await quickBooksService.revoke(user.clinicId, user.userId, this.auditContext(req)),
      });
    } catch (error) {
      next(error);
    }
  };

  listCustomers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      res.status(200).json({
        status: "success",
        data: await quickBooksService.listCustomers(user.clinicId, req.query.search ? String(req.query.search) : undefined),
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
        data: await quickBooksService.getClientMapping(user.clinicId, String(req.params.clientAccountProfileId)),
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
        data: await quickBooksService.saveClientMapping(
          user.clinicId,
          user.userId,
          String(req.params.clientAccountProfileId),
          req.body,
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
        data: await quickBooksService.deleteClientMapping(
          user.clinicId,
          user.userId,
          String(req.params.clientAccountProfileId),
          this.auditContext(req),
        ),
      });
    } catch (error) {
      next(error);
    }
  };
}

export const quickBooksController = new QuickBooksController();
