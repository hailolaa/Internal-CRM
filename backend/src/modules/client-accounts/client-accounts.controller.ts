import { Request, Response, NextFunction } from "express";
import { userHasPermission } from "../../middleware/authorize.js";
import { clientAccountsService } from "./client-accounts.service.js";

export class ClientAccountsController {
  private auditContext(req: Request) {
    return {
      ipAddress: req.ip || null,
      userAgent: req.get("user-agent") || null,
    };
  }

  listAccounts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const includeAllClinics = await userHasPermission(user.userId, user.clinicId, "*");
      const accounts = await clientAccountsService.listAccounts(user.clinicId, {
        includeAllClinics,
        query: req.query as any,
      });

      res.status(200).json({
        status: "success",
        data: accounts,
      });
    } catch (error) {
      next(error);
    }
  };

  createAccount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const account = await clientAccountsService.createAccount(
        user.userId,
        req.body,
        this.auditContext(req),
      );

      res.status(201).json({
        status: "success",
        data: account,
      });
    } catch (error) {
      next(error);
    }
  };

  createAccountFromContact = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const account = await clientAccountsService.createAccountFromContact(
        user.clinicId,
        user.userId,
        req.body,
        this.auditContext(req),
      );

      res.status(201).json({
        status: "success",
        data: account,
      });
    } catch (error) {
      next(error);
    }
  };

  getProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clinicId = (req as any).user.clinicId;
      const profile = await clientAccountsService.getProfile(clinicId);
      res.status(200).json({
        status: "success",
        data: profile,
      });
    } catch (error) {
      next(error);
    }
  };

  updateProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const profile = await clientAccountsService.updateProfile(
        user.clinicId,
        user.userId,
        req.body,
        this.auditContext(req),
      );

      res.status(200).json({
        status: "success",
        data: profile,
      });
    } catch (error) {
      next(error);
    }
  };

  updateDriveFolder = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const canManageAllClientAccounts = await userHasPermission(user.userId, user.clinicId, "*");
      const profile = await clientAccountsService.updateDriveFolder(
        user.clinicId,
        String(req.params.clinicId),
        user.userId,
        req.body,
        { canManageAllClientAccounts },
        this.auditContext(req),
      );

      res.status(200).json({
        status: "success",
        data: profile,
      });
    } catch (error) {
      next(error);
    }
  };

  getLinkedRecords = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const canManageAllClientAccounts = await userHasPermission(user.userId, user.clinicId, "*");
      const records = await clientAccountsService.getLinkedRecords(
        user.clinicId,
        String(req.params.clinicId),
        { canManageAllClientAccounts },
      );

      res.status(200).json({
        status: "success",
        data: records,
      });
    } catch (error) {
      next(error);
    }
  };

  linkContact = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const canManageAllClientAccounts = await userHasPermission(user.userId, user.clinicId, "*");
      const records = await clientAccountsService.linkContactToAccount(
        user.clinicId,
        String(req.params.clinicId),
        String(req.params.contactId),
        user.userId,
        { canManageAllClientAccounts },
        this.auditContext(req),
      );

      res.status(200).json({
        status: "success",
        data: records,
      });
    } catch (error) {
      next(error);
    }
  };

  unlinkContact = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const canManageAllClientAccounts = await userHasPermission(user.userId, user.clinicId, "*");
      const records = await clientAccountsService.unlinkContactFromAccount(
        user.clinicId,
        String(req.params.clinicId),
        String(req.params.contactId),
        user.userId,
        { canManageAllClientAccounts },
        this.auditContext(req),
      );

      res.status(200).json({
        status: "success",
        data: records,
      });
    } catch (error) {
      next(error);
    }
  };

  listContactClientAccountLinks = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const links = await clientAccountsService.listClientAccountsForContact(
        user.clinicId,
        String(req.params.contactId),
      );

      res.status(200).json({
        status: "success",
        data: links,
      });
    } catch (error) {
      next(error);
    }
  };

  listServices = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const canManageAllClientAccounts = await userHasPermission(user.userId, user.clinicId, "*");
      const services = await clientAccountsService.listServices(
        user.clinicId,
        req.query as any,
        { canManageAllClientAccounts },
      );
      res.status(200).json({
        status: "success",
        data: services,
      });
    } catch (error) {
      next(error);
    }
  };

  createService = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const service = await clientAccountsService.createService(
        user.clinicId,
        user.userId,
        req.body,
        this.auditContext(req),
      );

      res.status(201).json({
        status: "success",
        data: service,
      });
    } catch (error) {
      next(error);
    }
  };

  updateService = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { serviceId } = req.params;
      const service = await clientAccountsService.updateService(
        user.clinicId,
        user.userId,
        String(serviceId),
        req.body,
        this.auditContext(req),
      );

      res.status(200).json({
        status: "success",
        data: service,
      });
    } catch (error) {
      next(error);
    }
  };

  archiveService = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { serviceId } = req.params;
      await clientAccountsService.archiveService(
        user.clinicId,
        user.userId,
        String(serviceId),
        this.auditContext(req),
      );

      res.status(200).json({
        status: "success",
        message: "Client service archived successfully",
      });
    } catch (error) {
      next(error);
    }
  };
}

export const clientAccountsController = new ClientAccountsController();
