import { Request, Response, NextFunction } from "express";
import { reviewsService } from "./reviews.service.js";

export class ReviewsController {
  // GET /api/reviews
  // List clinic reviews
  listReviews = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const reviews = await reviewsService.listReviews(clinicId);
      res.status(200).json({ status: "success", data: reviews });
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/reviews/:id/status
  // Update review status
  updateReviewStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await reviewsService.updateReviewStatus(clinicId, userId, req.params.id as string, req.body.status);
      res.status(200).json({ status: "success", message: "Review updated successfully" });
    } catch (error) {
      next(error);
    }
  };

  getSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const data = await reviewsService.getReputationSummary(clinicId);
      res.status(200).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  };

  updateSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const data = await reviewsService.updateReputationSettings(clinicId, userId, req.body);
      res.status(200).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  };

  getSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const data = await reviewsService.getReputationSummary(clinicId);
      res.status(200).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  };

  listRequests = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const data = await reviewsService.listReviewRequests(clinicId);
      res.status(200).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  };

  createRequest = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const data = await reviewsService.createReviewRequest(clinicId, userId, req.body);
      res.status(201).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  };

  markRequestSent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await reviewsService.markReviewRequestSent(clinicId, userId, String(req.params.id));
      res.status(200).json({ status: "success", message: "Review request marked sent." });
    } catch (error) {
      next(error);
    }
  };

  updateChecklist = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const data = await reviewsService.updateChecklistItem(clinicId, userId, String(req.params.itemKey), req.body.completed === true);
      res.status(200).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  };

  suggestReply = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const data = await reviewsService.suggestReply(clinicId, req.body);
      res.status(200).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  };

  replyHandoff = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const data = await reviewsService.getReviewReplyHandoff(clinicId, userId, String(req.params.id));
      res.status(200).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  };
}

export const reviewsController = new ReviewsController();
