import { Request, Response, NextFunction } from "express";
import { commsService } from "./comms.service.js";
import { whatsappAiService } from "./whatsapp-ai.service.js";

export class CommsController {
  // GET /api/comms/inbox
  listInbox = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const conversations = await commsService.listInbox(clinicId, {
        archived: req.query.archived as any,
      });
      res.status(200).json({ status: "success", data: conversations });
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/comms/inbox/read-all
  markAllRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const result = await commsService.markAllRead(clinicId, userId);
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/comms/inbox/:contactId/read
  updateReadState = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const conversation = await commsService.updateReadState(
        clinicId,
        userId,
        String(req.params.id),
        Boolean(req.body.unread),
      );
      res.status(200).json({ status: "success", data: conversation });
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/comms/inbox/:contactId/star
  updateStarState = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const conversation = await commsService.updateStarState(
        clinicId,
        userId,
        String(req.params.id),
        Boolean(req.body.starred),
      );
      res.status(200).json({ status: "success", data: conversation });
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/comms/inbox/:contactId/archive
  updateArchiveState = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const conversation = await commsService.updateArchiveState(
        clinicId,
        userId,
        String(req.params.id),
        Boolean(req.body.archived),
      );
      res.status(200).json({ status: "success", data: conversation });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/comms/inbox/:contactId
  getConversation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const conversation = await commsService.getConversation(clinicId, String(req.params.id));

      if (!conversation) {
        return res.status(404).json({ status: "error", message: "Conversation not found" });
      }

      res.status(200).json({ status: "success", data: conversation });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/comms/inbox/:contactId/messages
  sendMessage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const message = await commsService.sendMessage(clinicId, userId, String(req.params.id), req.body);
      res.status(201).json({ status: "success", data: message });
    } catch (error) {
      next(error);
    }
  };

  getWhatsAppAiSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const settings = await whatsappAiService.getSettings(clinicId);
      res.status(200).json({ status: "success", data: settings });
    } catch (error) {
      next(error);
    }
  };

  updateWhatsAppAiSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const settings = await whatsappAiService.updateSettings(clinicId, userId, req.body);
      res.status(200).json({ status: "success", data: settings });
    } catch (error) {
      next(error);
    }
  };

  ingestWhatsAppInbound = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const result = await whatsappAiService.ingestInbound(clinicId, userId, req.body);
      res.status(201).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  };

  getWhatsAppConversation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const result = await whatsappAiService.listConversation(clinicId, String(req.params.id));
      if (!result) {
        return res.status(404).json({ status: "error", message: "WhatsApp conversation not found" });
      }
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  };

  sendWhatsAppMessage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const message = await whatsappAiService.sendManualMessage(
        clinicId,
        userId,
        String(req.params.id),
        req.body,
      );
      res.status(201).json({ status: "success", data: message });
    } catch (error) {
      next(error);
    }
  };

  draftWhatsAppReply = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const reply = await whatsappAiService.createDraft(clinicId, userId, req.body);
      res.status(201).json({ status: "success", data: reply });
    } catch (error) {
      next(error);
    }
  };

  approveWhatsAppReply = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const reply = await whatsappAiService.approveReply(clinicId, userId, String(req.params.replyId), req.body);
      res.status(200).json({ status: "success", data: reply });
    } catch (error) {
      next(error);
    }
  };

  retryWhatsAppReply = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const reply = await whatsappAiService.retryReply(clinicId, userId, String(req.params.replyId), req.body);
      res.status(200).json({ status: "success", data: reply });
    } catch (error) {
      next(error);
    }
  };
}

export const commsController = new CommsController();
