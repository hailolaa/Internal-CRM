import { Request, Response, NextFunction } from "express";
import { sequencesService } from "./sequences.service.js";

export class SequencesController {
  // GET /api/sequences
  listSequences = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const sequences = await sequencesService.listSequences(clinicId);
      res.status(200).json({ status: "success", data: sequences });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/sequences
  createSequence = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const id = await sequencesService.createSequence(clinicId, userId, req.body);
      res.status(201).json({ status: "success", data: { id } });
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/sequences/:id
  updateSequence = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await sequencesService.updateSequence(clinicId, userId, req.params.id as string, req.body);
      res.status(200).json({ status: "success", message: "Sequence updated successfully" });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/sequences/:id/enrollments
  listEnrollments = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const enrollments = await sequencesService.listEnrollments(clinicId, req.params.id as string);
      res.status(200).json({ status: "success", data: enrollments });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/sequences/:id/enrollments
  enrollContact = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const enrollment = await sequencesService.enrollContact(clinicId, userId, req.params.id as string, req.body);
      res.status(201).json({ status: "success", data: enrollment });
    } catch (error) {
      next(error);
    }
  };

  // DELETE /api/sequences/:id/enrollments/:enrollmentId
  unenrollContact = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const enrollment = await sequencesService.unenrollContact(
        clinicId,
        userId,
        req.params.id as string,
        req.params.enrollmentId as string,
      );
      res.status(200).json({ status: "success", data: enrollment });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/sequences/run-due
  runDueSequences = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await sequencesService.processDueSequences({
        limit: Number(req.query.limit || 50),
      });
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  };

  // DELETE /api/sequences/:id
  deleteSequence = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await sequencesService.deleteSequence(clinicId, userId, req.params.id as string);
      res.status(200).json({ status: "success", message: "Sequence deleted successfully" });
    } catch (error) {
      next(error);
    }
  };
}

export const sequencesController = new SequencesController();

