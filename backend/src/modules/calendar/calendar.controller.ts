import { Request, Response, NextFunction } from "express";
import { calendarService } from "./calendar.service.js";

export class CalendarController {
  getStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      res.status(200).json({ status: "success", data: await calendarService.getStatus(clinicId) });
    } catch (error) {
      next(error);
    }
  };

  startOAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      res.status(200).json({
        status: "success",
        data: { authorizeUrl: calendarService.getAuthorizationUrl(clinicId, userId) },
      });
    } catch (error) {
      next(error);
    }
  };

  revoke = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await calendarService.revoke(clinicId, userId);
      res.status(200).json({ status: "success" });
    } catch (error) {
      next(error);
    }
  };

  syncUpcoming = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const result = await calendarService.syncUpcoming(clinicId, userId);
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  };

  listMeetings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      res.status(200).json({
        status: "success",
        data: await calendarService.listMeetings(clinicId, req.query as any),
      });
    } catch (error) {
      next(error);
    }
  };

  updateMeetingLinks = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      res.status(200).json({
        status: "success",
        data: await calendarService.updateMeetingLinks(
          clinicId,
          userId,
          String(req.params.id),
          req.body,
        ),
      });
    } catch (error) {
      next(error);
    }
  };

}

export const calendarController = new CalendarController();
