import { Request, Response, NextFunction } from "express";
import { rolesService } from "./roles.service.js";

export class RolesController {
  // GET /api/roles
  // List system and clinic roles
  listRoles = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const roles = await rolesService.listRoles(clinicId);
      res.status(200).json({ status: "success", data: roles });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/roles/permissions
  // List available permission keys
  listPermissions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const permissions = await rolesService.listPermissions();
      res.status(200).json({ status: "success", data: permissions });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/roles
  // Create a clinic-scoped role
  createRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const role = await rolesService.createRole(clinicId, userId, req.body);
      res.status(201).json({ status: "success", data: role });
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/roles/:id
  // Update a clinic-scoped role
  updateRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const role = await rolesService.updateRole(clinicId, userId, req.params.id as string, req.body);
      res.status(200).json({ status: "success", data: role });
    } catch (error) {
      next(error);
    }
  };

  // DELETE /api/roles/:id
  // Archive a clinic-scoped role
  archiveRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await rolesService.archiveRole(clinicId, userId, req.params.id as string);
      res.status(200).json({ status: "success", message: "Role archived successfully" });
    } catch (error) {
      next(error);
    }
  };
}

export const rolesController = new RolesController();
