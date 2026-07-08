import { Request, Response, NextFunction } from "express";
import { reportsService } from "./reports.service.js";

function pickDashboardQuery(query: Record<string, unknown>) {
  const result: { startDate?: string; endDate?: string } = {};
  if (query.startDate) result.startDate = String(query.startDate);
  if (query.endDate) result.endDate = String(query.endDate);
  return result;
}

export class ReportsController {
  // GET /api/reports/shared/:token
  getSharedReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const report = await reportsService.getSharedReport(req.params.token as string);
      res.status(200).json({ status: "success", data: report });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/reports
  listReports = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const reports = await reportsService.listReports(clinicId);
      res.status(200).json({ status: "success", data: reports });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/reports/:id
  getReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const report = await reportsService.getReport(clinicId, req.params.id as string);
      res.status(200).json({ status: "success", data: report });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/reports/:id/share
  createReportShare = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const share = await reportsService.createReportShare(clinicId, userId, req.params.id as string);
      res.status(201).json({ status: "success", data: share });
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/reports/:id/workflow
  updateReportWorkflow = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const payload: Record<string, unknown> = {};
      ["aiDraftSummary", "clientCommentary", "internalNotes", "workflowStatus"].forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) {
          payload[key] = req.body[key];
        }
      });
      const report = await reportsService.updateReportWorkflow(clinicId, userId, req.params.id as string, payload);
      res.status(200).json({ status: "success", data: report });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/reports/monthly
  generateMonthlyReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const report = await reportsService.generateMonthlyReport(clinicId, userId, req.body?.month);
      res.status(201).json({ status: "success", data: report });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/reports/dashboards
  listDashboards = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const dashboards = await reportsService.listDashboards(clinicId);
      res.status(200).json({ status: "success", data: dashboards });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/reports/exports/:type
  exportPhase1Report = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const result = await reportsService.exportPhase1Report(clinicId, {
        type: String(req.params.type || ""),
        format: req.query.format ? String(req.query.format) : "csv",
        ...pickDashboardQuery(req.query as Record<string, unknown>),
      });

      res.setHeader("Content-Type", result.contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
      res.setHeader("X-Report-Export-Type", result.metadata.type);
      res.setHeader("X-Report-Export-Format", result.metadata.format);
      res.setHeader("X-Report-Export-Row-Count", String(result.metadata.rowCount));
      res.status(200).send(result.content);
    } catch (error) {
      next(error);
    }
  };

  // GET /api/reports/dashboard/summary
  getDashboardSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const summary = await reportsService.getDashboardSummary(clinicId, pickDashboardQuery(req.query as Record<string, unknown>));
      res.status(200).json({ status: "success", data: summary });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/reports/dashboard/funnel
  getDashboardFunnel = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const funnel = await reportsService.getDashboardFunnel(clinicId, pickDashboardQuery(req.query as Record<string, unknown>));
      res.status(200).json({ status: "success", data: funnel });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/reports/dashboard/revenue-by-channel
  getRevenueByChannel = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const metrics = await reportsService.getRevenueByChannel(clinicId, pickDashboardQuery(req.query as Record<string, unknown>));
      res.status(200).json({ status: "success", data: metrics });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/reports/dashboard/revenue-by-treatment
  getRevenueByTreatment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const metrics = await reportsService.getRevenueByTreatment(clinicId, pickDashboardQuery(req.query as Record<string, unknown>));
      res.status(200).json({ status: "success", data: metrics });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/reports/treatments/:treatment/detail
  getTreatmentPerformanceDetail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const detail = await reportsService.getTreatmentPerformanceDetail(
        clinicId,
        String(req.params.treatment || ""),
        pickDashboardQuery(req.query as Record<string, unknown>),
      );
      res.status(200).json({ status: "success", data: detail });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/reports/dashboard/revenue-leaks
  getRevenueLeaks = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const metrics = await reportsService.getRevenueLeaks(clinicId, pickDashboardQuery(req.query as Record<string, unknown>));
      res.status(200).json({ status: "success", data: metrics });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/reports/dashboard/revenue-leak-details
  getRevenueLeakDetails = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const metrics = await reportsService.getRevenueLeakDetails(clinicId, pickDashboardQuery(req.query as Record<string, unknown>));
      res.status(200).json({ status: "success", data: metrics });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/reports/dashboard/top-opportunities
  getTopOpportunities = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const metrics = await reportsService.getTopOpportunities(clinicId, pickDashboardQuery(req.query as Record<string, unknown>));
      res.status(200).json({ status: "success", data: metrics });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/reports/dashboard/monthly-trend
  getMonthlyTrend = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const metrics = await reportsService.getMonthlyTrend(clinicId, pickDashboardQuery(req.query as Record<string, unknown>));
      res.status(200).json({ status: "success", data: metrics });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/reports/dashboard/risk-opportunity-sections
  getRiskOpportunitySections = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const metrics = await reportsService.getRiskOpportunitySections(clinicId, pickDashboardQuery(req.query as Record<string, unknown>));
      res.status(200).json({ status: "success", data: metrics });
    } catch (error) {
      next(error);
    }
  };
}

export const reportsController = new ReportsController();
