import { Request, Response, NextFunction } from "express";
import { strategyLogsService } from "./strategy-logs.service.js";

export class StrategyLogsController {
  listLogs = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const logs = await strategyLogsService.listLogs(clinicId, req.query as any);
      res.status(200).json({ status: "success", data: logs });
    } catch (error) {
      next(error);
    }
  };

  createLog = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const id = await strategyLogsService.createLog(clinicId, userId, req.body);
      res.status(201).json({ status: "success", data: { id } });
    } catch (error) {
      next(error);
    }
  };

  updateLog = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await strategyLogsService.updateLog(clinicId, userId, req.params.id as string, req.body);
      res.status(200).json({ status: "success", message: "Strategy log updated successfully" });
    } catch (error) {
      next(error);
    }
  };

  archiveLog = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await strategyLogsService.archiveLog(clinicId, userId, req.params.id as string);
      res.status(200).json({ status: "success", message: "Strategy log archived successfully" });
    } catch (error) {
      next(error);
    }
  };
}

export const strategyLogsController = new StrategyLogsController();
