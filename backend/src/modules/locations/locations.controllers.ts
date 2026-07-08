import { Request, Response, NextFunction } from "express";
import { locationsService } from "./locations.service.js";

export class LocationsController {
  
  // POST /api/locations
  // Create a new branch for the clinic
  
  createLocation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const locationId = await locationsService.createLocation(clinicId, req.body);
      res.status(201).json({
        status: "success",
        data: { id: locationId },
      });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/locations
  // List all branches for the current clinic

  getLocations = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const locations = await locationsService.getLocations(clinicId);
      res.status(200).json({
        status: "success",
        data: locations,
      });
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/locations/:id
  // Update details of a specific branch

  updateLocation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const id = req.params.id as string;
      await locationsService.updateLocation(clinicId, id, req.body);
      res.status(200).json({
        status: "success",
        message: "Location updated successfully",
      });
    } catch (error) {
      next(error);
    }
  };

  
  // DELETE /api/locations/:id
  // Remove a branch (Soft delete)

  deleteLocation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const id = req.params.id as string;
      await locationsService.deleteLocation(clinicId, id);
      res.status(200).json({
        status: "success",
        message: "Location deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  };
}

export const locationsController = new LocationsController();
