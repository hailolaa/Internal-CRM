import { Request, Response, NextFunction } from "express";
import { tasksService } from "./tasks.service.js";
import { userCanManageAllClientAccounts } from "../../middleware/authorize.js";

export class TasksController {
  // GET /api/tasks
  // List clinic tasks
  listTasks = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const tasks = await tasksService.listTasks(clinicId);
      res.status(200).json({ status: "success", data: tasks });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/tasks
  // Create a clinic task
  createTask = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const id = await tasksService.createTask(clinicId, userId, req.body);
      res.status(201).json({ status: "success", data: { id } });
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/tasks/:id
  // Update a clinic task
  updateTask = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await tasksService.updateTask(clinicId, userId, req.params.id as string, req.body);
      res.status(200).json({ status: "success", message: "Task updated successfully" });
    } catch (error) {
      next(error);
    }
  };

  // DELETE /api/tasks/:id
  // Soft delete a clinic task
  deleteTask = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await tasksService.deleteTask(clinicId, userId, req.params.id as string);
      res.status(200).json({ status: "success", message: "Task deleted successfully" });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/tasks/internal
  // List Clinic Grower internal delivery tasks
  listInternalTasks = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const canManageAllClientAccounts = await userCanManageAllClientAccounts(userId, clinicId);
      const tasks = await tasksService.listInternalTasks(clinicId, req.query as any, { canManageAllClientAccounts });
      res.status(200).json({ status: "success", data: tasks });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/tasks/internal
  // Create a Clinic Grower internal delivery task
  createInternalTask = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const canManageAllClientAccounts = await userCanManageAllClientAccounts(userId, clinicId);
      const id = await tasksService.createInternalTask(clinicId, userId, req.body, { canManageAllClientAccounts });
      res.status(201).json({ status: "success", data: { id } });
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/tasks/internal/:id
  // Update a Clinic Grower internal delivery task
  updateInternalTask = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const canManageAllClientAccounts = await userCanManageAllClientAccounts(userId, clinicId);
      await tasksService.updateInternalTask(clinicId, userId, String(req.params.id), req.body, { canManageAllClientAccounts });
      res.status(200).json({ status: "success", message: "Internal task updated successfully" });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/tasks/internal/:id/archive
  // Archive a Clinic Grower internal delivery task
  archiveInternalTask = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await tasksService.archiveInternalTask(clinicId, userId, String(req.params.id));
      res.status(200).json({ status: "success", message: "Internal task archived successfully" });
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/tasks/internal/:id/qa
  // Update lightweight QA state for a Clinic Grower internal delivery task
  updateInternalTaskQa = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await tasksService.updateInternalTaskQa(clinicId, userId, String(req.params.id), req.body);
      res.status(200).json({ status: "success", message: "Internal task QA updated successfully" });
    } catch (error) {
      next(error);
    }
  };
}

export const tasksController = new TasksController();
