import { Request, Response, NextFunction } from "express";
import { aiWorkspaceService } from "./ai-workspace.service.js";

export class AiWorkspaceController {
  // GET /api/ai/projects
  listProjects = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const projects = await aiWorkspaceService.listProjects(clinicId);
      res.status(200).json({ status: "success", data: projects });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/ai/projects
  createProject = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const id = await aiWorkspaceService.createProject(clinicId, userId, req.body);
      res.status(201).json({ status: "success", data: { id } });
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/ai/projects/:id
  updateProject = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await aiWorkspaceService.updateProject(clinicId, userId, req.params.id as string, req.body);
      res.status(200).json({ status: "success", message: "AI project updated successfully" });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/ai/runs
  listRuns = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const filters: { agentKey?: string } = {};
      if (req.query.agentKey) filters.agentKey = String(req.query.agentKey);
      const runs = await aiWorkspaceService.listRuns(clinicId, filters);
      res.status(200).json({ status: "success", data: runs });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/ai/runs
  createRun = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const id = await aiWorkspaceService.createRun(clinicId, userId, req.body);
      res.status(201).json({ status: "success", data: { id } });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/ai/growth-brief/generate
  generateGrowthBrief = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const run = await aiWorkspaceService.generateGrowthBrief(clinicId, userId, req.body || {});
      res.status(201).json({ status: "success", data: run });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/ai/show-rate/generate
  generateShowRate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const run = await aiWorkspaceService.generateShowRate(clinicId, userId, req.body || {});
      res.status(201).json({ status: "success", data: run });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/ai/sales-assistant/generate
  generateSalesAssistant = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const run = await aiWorkspaceService.generateSalesAssistant(clinicId, userId, req.body || {});
      res.status(201).json({ status: "success", data: run });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/ai/campaign-analyst/generate
  generateCampaignAnalyst = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const run = await aiWorkspaceService.generateCampaignAnalyst(clinicId, userId, req.body || {});
      res.status(201).json({ status: "success", data: run });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/ai/ltv-optimiser/generate
  generateLtvOptimiser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const run = await aiWorkspaceService.generateLtvOptimiser(clinicId, userId, req.body || {});
      res.status(201).json({ status: "success", data: run });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/ai/competitor-insights/generate
  generateCompetitorInsights = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const run = await aiWorkspaceService.generateCompetitorInsights(clinicId, userId, req.body || {});
      res.status(201).json({ status: "success", data: run });
    } catch (error) {
      next(error);
    }
  };
}

export const aiWorkspaceController = new AiWorkspaceController();
