import { Request, Response, NextFunction } from "express";
import { messageTemplatesService } from "./message-templates.service.js";
import { MESSAGE_TEMPLATE_PLACEHOLDERS } from "./message-templates.types.js";

export class MessageTemplatesController {
  // GET /api/message-templates
  // List message templates
  listTemplates = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const templates = await messageTemplatesService.listTemplates(clinicId, {
        channel: req.query.channel ? String(req.query.channel) as any : undefined,
        status: req.query.status ? String(req.query.status) as any : undefined,
      });
      res.status(200).json({
        status: "success",
        data: templates,
        meta: {
          availablePlaceholders: MESSAGE_TEMPLATE_PLACEHOLDERS,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/message-templates/:id
  // Fetch a single template
  getTemplate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const template = await messageTemplatesService.getTemplate(clinicId, req.params.id as string);
      res.status(200).json({ status: "success", data: template });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/message-templates
  // Create a message template
  createTemplate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const template = await messageTemplatesService.createTemplate(clinicId, userId, req.body);
      res.status(201).json({ status: "success", data: template });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/message-templates/:id/test-send
  // Send or queue a template test delivery.
  testSendTemplate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const result = await messageTemplatesService.testSendTemplate(clinicId, userId, req.params.id as string, req.body);
      res.status(200).json({
        status: "success",
        data: result,
        message: result.deliveryStatus === "sent" ? "Test message sent successfully" : "Test message queued successfully",
      });
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/message-templates/:id
  // Update a message template
  updateTemplate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const template = await messageTemplatesService.updateTemplate(clinicId, userId, req.params.id as string, req.body);
      res.status(200).json({ status: "success", data: template, message: "Message template updated successfully" });
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/message-templates/:id/archive
  // Archive a message template
  archiveTemplate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const template = await messageTemplatesService.archiveTemplate(clinicId, userId, req.params.id as string);
      res.status(200).json({ status: "success", data: template, message: "Message template archived successfully" });
    } catch (error) {
      next(error);
    }
  };

  // DELETE /api/message-templates/:id
  // Soft delete a message template
  deleteTemplate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await messageTemplatesService.deleteTemplate(clinicId, userId, req.params.id as string);
      res.status(200).json({ status: "success", message: "Message template deleted successfully" });
    } catch (error) {
      next(error);
    }
  };
}

export const messageTemplatesController = new MessageTemplatesController();
