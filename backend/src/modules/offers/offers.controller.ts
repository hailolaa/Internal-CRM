import { Request, Response, NextFunction } from "express";
import { offersService } from "./offers.service.js";

export class OffersController {
  // GET /api/offers
  // List marketing offers
  listOffers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const offers = await offersService.listOffers(clinicId);
      res.status(200).json({ status: "success", data: offers });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/offers
  // Create a marketing offer
  createOffer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const id = await offersService.createOffer(clinicId, userId, req.body);
      res.status(201).json({ status: "success", data: { id } });
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/offers/:id
  // Update a marketing offer
  updateOffer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await offersService.updateOffer(clinicId, userId, req.params.id as string, req.body);
      res.status(200).json({ status: "success", message: "Offer updated successfully" });
    } catch (error) {
      next(error);
    }
  };

  // DELETE /api/offers/:id
  // Soft delete a marketing offer
  deleteOffer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await offersService.deleteOffer(clinicId, userId, req.params.id as string);
      res.status(200).json({ status: "success", message: "Offer deleted successfully" });
    } catch (error) {
      next(error);
    }
  };
}

export const offersController = new OffersController();
