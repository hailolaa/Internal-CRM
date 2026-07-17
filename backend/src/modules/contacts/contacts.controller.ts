import { Request, Response, NextFunction } from "express";
import { contactsService } from "./contacts.service.js";
import type { ContactListQuery } from "./contacts.types.js";
import { userHasPermission } from "../../middleware/authorize.js";

function getRequestMeta(req: Request) {
  return {
    ipAddress: req.ip || null,
    userAgent: req.get("user-agent") || null,
  };
}

export class ContactsController {
  listContacts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clinicId = (req as any).user.clinicId;
      const query: ContactListQuery = {};
      if (req.query.page) query.page = Number(req.query.page);
      if (req.query.limit || req.query.pageSize) query.limit = Number(req.query.limit || req.query.pageSize);
      if (req.query.search) query.search = String(req.query.search);
      if (req.query.status) query.status = String(req.query.status);
      if (req.query.leadStatus) query.leadStatus = String(req.query.leadStatus);
      if (req.query.source) query.source = String(req.query.source);
      if (req.query.tag) query.tag = String(req.query.tag);
      if (req.query.campaign) query.campaign = String(req.query.campaign);
      if (req.query.utmSource) query.utmSource = String(req.query.utmSource);
      if (req.query.utmMedium) query.utmMedium = String(req.query.utmMedium);
      if (req.query.utmCampaign) query.utmCampaign = String(req.query.utmCampaign);
      if (req.query.createdFrom) query.createdFrom = String(req.query.createdFrom);
      if (req.query.createdTo) query.createdTo = String(req.query.createdTo);
      if (req.query.sortBy) query.sortBy = String(req.query.sortBy) as any;
      if (req.query.sortOrder || req.query.sortDir) {
        query.sortOrder = String(req.query.sortOrder || req.query.sortDir) as any;
      }

      const result = await contactsService.listContacts(clinicId, query);

      res.status(200).json({
        status: "success",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  exportContactsCsv = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clinicId = (req as any).user.clinicId;
      const query: ContactListQuery = {};
      if (req.query.search) query.search = String(req.query.search);
      if (req.query.status) query.status = String(req.query.status);
      if (req.query.leadStatus) query.leadStatus = String(req.query.leadStatus);
      if (req.query.source) query.source = String(req.query.source);
      if (req.query.tag) query.tag = String(req.query.tag);
      if (req.query.campaign) query.campaign = String(req.query.campaign);
      if (req.query.utmSource) query.utmSource = String(req.query.utmSource);
      if (req.query.utmMedium) query.utmMedium = String(req.query.utmMedium);
      if (req.query.utmCampaign) query.utmCampaign = String(req.query.utmCampaign);
      if (req.query.createdFrom) query.createdFrom = String(req.query.createdFrom);
      if (req.query.createdTo) query.createdTo = String(req.query.createdTo);
      if (req.query.sortBy) query.sortBy = String(req.query.sortBy) as any;
      if (req.query.sortOrder || req.query.sortDir) {
        query.sortOrder = String(req.query.sortOrder || req.query.sortDir) as any;
      }

      const csv = await contactsService.exportContactsCsv(clinicId, query);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="contacts-export.csv"');
      res.status(200).send(csv);
    } catch (error) {
      next(error);
    }
  };

  createContact = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const result = await contactsService.createContact(
        user.clinicId,
        user.userId,
        req.body,
        getRequestMeta(req),
      );

      res.status(201).json({
        status: "success",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getContact = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clinicId = (req as any).user.clinicId;
      const contact = await contactsService.getContact(clinicId, String(req.params.id));

      res.status(200).json({
        status: "success",
        data: contact,
      });
    } catch (error) {
      next(error);
    }
  };

  getContactTimeline = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clinicId = (req as any).user.clinicId;
      const timeline = await contactsService.getContactTimeline(clinicId, String(req.params.id));

      res.status(200).json({
        status: "success",
        data: timeline,
      });
    } catch (error) {
      next(error);
    }
  };

  getContactLinkedActivity = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const activity = await contactsService.getContactLinkedActivity(
        user.clinicId,
        String(req.params.id),
        await this.getDrawerActionContext(user),
      );

      res.status(200).json({
        status: "success",
        data: activity,
      });
    } catch (error) {
      next(error);
    }
  };

  getLeadDrawerActions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      await contactsService.getContact(user.clinicId, String(req.params.id));

      res.status(200).json({
        status: "success",
        data: contactsService.getLeadDrawerActions(
          String(req.params.id),
          await this.getDrawerActionContext(user),
        ),
      });
    } catch (error) {
      next(error);
    }
  };

  logLeadCallOutcome = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const result = await contactsService.logLeadCallOutcome(
        user.clinicId,
        user.userId,
        String(req.params.id),
        req.body,
        await this.getDrawerActionContext(user),
      );

      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  };

  sendLeadMessageTemplate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const result = await contactsService.sendLeadMessageTemplate(
        user.clinicId,
        user.userId,
        String(req.params.id),
        req.body,
        await this.getDrawerActionContext(user),
      );

      res.status(201).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  };

  createLeadBooking = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const result = await contactsService.createLeadBooking(
        user.clinicId,
        user.userId,
        String(req.params.id),
        req.body,
        await this.getDrawerActionContext(user),
      );

      res.status(201).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  };

  recordLeadDeposit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const result = await contactsService.recordLeadDeposit(
        user.clinicId,
        user.userId,
        String(req.params.id),
        req.body,
        await this.getDrawerActionContext(user),
      );

      res.status(req.body.depositId ? 200 : 201).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  };

  createLeadTask = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const result = await contactsService.createLeadTask(
        user.clinicId,
        user.userId,
        String(req.params.id),
        req.body,
        await this.getDrawerActionContext(user),
      );

      res.status(201).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  };

  addContactNote = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const result = await contactsService.addContactNote(
        user.clinicId,
        user.userId,
        String(req.params.id),
        req.body,
        await this.getDrawerActionContext(user),
        getRequestMeta(req),
      );

      res.status(201).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  };

  recordContactAttempt = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const result = await contactsService.recordContactAttempt(
        user.clinicId,
        user.userId,
        String(req.params.id),
        req.body,
        await this.getDrawerActionContext(user),
        getRequestMeta(req),
      );

      res.status(201).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  };

  recordSalesCallDemo = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const result = await contactsService.recordSalesCallDemo(
        user.clinicId,
        user.userId,
        String(req.params.id),
        req.body,
        await this.getDrawerActionContext(user),
        getRequestMeta(req),
      );

      res.status(201).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  };

  updateContact = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const contact = await contactsService.updateContactProfile(
        user.clinicId,
        user.userId,
        String(req.params.id),
        req.body,
        getRequestMeta(req),
      );

      res.status(200).json({
        status: "success",
        data: contact,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteContact = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      await contactsService.deleteContact(
        user.clinicId,
        user.userId,
        String(req.params.id),
        getRequestMeta(req),
      );

      res.status(200).json({
        status: "success",
        message: "Contact deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  };

  importContacts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const result = await contactsService.importContacts(
        user.clinicId,
        user.userId,
        req.body,
        getRequestMeta(req),
      );

      res.status(201).json({
        status: "success",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  previewImportContacts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await contactsService.previewImportContacts(req.body);

      res.status(200).json({
        status: "success",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  listDuplicateCandidates = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const clinicId = (req as any).user.clinicId;
      const candidates = await contactsService.listDuplicateCandidates(clinicId);

      res.status(200).json({
        status: "success",
        data: candidates,
      });
    } catch (error) {
      next(error);
    }
  };

  listImportBatches = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const clinicId = (req as any).user.clinicId;
      const batches = await contactsService.listImportBatches(clinicId);

      res.status(200).json({
        status: "success",
        data: batches,
      });
    } catch (error) {
      next(error);
    }
  };

  getImportBatch = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clinicId = (req as any).user.clinicId;
      const batchId = String(req.params.id);
      const batch = await contactsService.getImportBatch(clinicId, batchId);

      res.status(200).json({ status: "success", data: batch });
    } catch (error) {
      next(error);
    }
  };

  resolveDuplicateCandidate = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const user = (req as any).user;
      await contactsService.resolveDuplicateCandidate(
        user.clinicId,
        user.userId,
        String(req.params.candidateId),
        String(req.body.status),
        getRequestMeta(req),
      );

      res.status(200).json({
        status: "success",
        message: "Duplicate candidate updated successfully",
      });
    } catch (error) {
      next(error);
    }
  };

  markContacted = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const result = await contactsService.markContacted(
        user.clinicId,
        user.userId,
        String(req.params.id || ""),
        getRequestMeta(req),
      );

      res.status(200).json({
        status: "success",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  private async getDrawerActionContext(user: any) {
    const permissionKeys = ["contacts:write", "calls:write", "marketing:read", "appointments:write", "reports:write", "events:write"];
    const permissions: Record<string, boolean> = {};

    await Promise.all(permissionKeys.map(async (permission) => {
      permissions[permission] = await userHasPermission(user.userId, user.clinicId, permission);
    }));

    return {
      userId: user.userId,
      permissions,
    };
  }
}

export const contactsController = new ContactsController();
