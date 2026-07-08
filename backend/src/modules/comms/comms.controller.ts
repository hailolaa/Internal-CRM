import { Request, Response, NextFunction } from "express";
import { commsService } from "./comms.service.js";

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
}

export const commsController = new CommsController();
