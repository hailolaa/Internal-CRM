import { Request, Response, NextFunction } from "express";
import { callsService } from "./calls.service.js";
import { messageTemplatesService } from "../message-templates/message-templates.service.js";

function getDateFilters(req: Request) {
  const filters: { startDate?: string; endDate?: string } = {};
  if (typeof req.query.startDate === "string") {
    filters.startDate = req.query.startDate;
  }
  if (typeof req.query.endDate === "string") {
    filters.endDate = req.query.endDate;
  }
  return filters;
}

export class CallsController {
  // POST /api/calls
  createCall = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const call = await callsService.createCall(clinicId, userId, req.body);
      res.status(201).json({ status: "success", data: call });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/calls
  listCalls = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const missedQuery = String((req.query as any).missed ?? "").toLowerCase();
      const missedOnly = missedQuery === "true" || missedQuery === "1" ? true : missedQuery === "false" || missedQuery === "0" ? false : undefined;
      const calls = await callsService.listCalls(clinicId, {
        ...getDateFilters(req),
        ...(missedOnly === undefined ? {} : { missedOnly }),
      });
      res.status(200).json({ status: "success", data: calls });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/calls/:id
  getCall = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const call = await callsService.getCall(clinicId, String(req.params.id || ""));
      res.status(200).json({ status: "success", data: call });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/calls/outcomes
  getOutcomeOptions = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(200).json({ status: "success", data: callsService.getOutcomeOptions() });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/calls/export/csv
  exportCsv = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const csv = await callsService.exportCallsCsv(clinicId);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="calls-export.csv"');
      res.status(200).send(csv);
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/calls/:id
  updateCall = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const call = await callsService.updateCall(
        clinicId,
        userId,
        String(req.params.id || ""),
        req.body,
      );
      res.status(200).json({ status: "success", data: call });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/calls/:id/recording-deletion-requests
  createRecordingDeletionRequest = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const request = await callsService.createRecordingDeletionRequest(
        clinicId,
        userId,
        String(req.params.id || ""),
        req.body,
      );
      res.status(201).json({ status: "success", data: request });
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/calls/recording-deletion-requests/:requestId
  updateRecordingDeletionRequest = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const request = await callsService.updateRecordingDeletionRequest(
        clinicId,
        userId,
        String(req.params.requestId || ""),
        req.body,
      );
      res.status(200).json({ status: "success", data: request });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/calls/:id/generate-intelligence
  generateIntelligence = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const call = await callsService.generateCallIntelligence(
        clinicId,
        userId,
        String(req.params.id || ""),
      );
      res.status(200).json({ status: "success", data: call });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/calls/:id/transcribe
  transcribeRecording = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const call = await callsService.transcribeCallRecording(
        clinicId,
        userId,
        String(req.params.id || ""),
        { generateIntelligence: req.body.generateIntelligence !== false },
      );
      res.status(200).json({ status: "success", data: call });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/calls/summary
  getSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const summary = await callsService.getCallSummary(clinicId, getDateFilters(req));
      res.status(200).json({ status: "success", data: summary });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/metrics/calls/staff
  getStaffMetrics = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const metrics = await callsService.getStaffCallMetrics(clinicId, getDateFilters(req));
      res.status(200).json({ status: "success", data: metrics });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/calls/analytics/breakdowns
  getAnalyticsBreakdowns = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const breakdowns = await callsService.getCallAnalyticsBreakdowns(clinicId, getDateFilters(req));
      res.status(200).json({ status: "success", data: breakdowns });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/calls/:id/follow-up
  // Queue or send a missed-call SMS follow-up using a message template
  followUp = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const callId = req.params.id as string;
      const templateId = req.body.templateId as string | undefined;
      const sendNow = req.body.sendNow === true;

      const result = await callsService.createMissedCallFollowUp(clinicId, userId, callId, templateId, sendNow);
      res.status(201).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  };
}

export const callsController = new CallsController();
