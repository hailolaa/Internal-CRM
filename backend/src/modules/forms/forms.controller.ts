import { Request, Response, NextFunction } from "express";
import { formsService } from "./forms.service.js";

// Public submission endpoint uses api key middleware and sets (req as any).apiKey

export class FormsController {
  // GET /api/forms
  listForms = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const forms = await formsService.listForms(clinicId);
      res.status(200).json({ status: "success", data: forms });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/forms/submissions
  listSubmissions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const submissions = await formsService.listSubmissions(clinicId);
      res.status(200).json({ status: "success", data: submissions });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/forms/submissions/:id/pipeline
  linkSubmissionToPipeline = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const result = await formsService.linkSubmissionToPipeline(clinicId, userId, req.params.id as string, req.body);
      res.status(200).json({ status: "success", data: result, message: "Submission added to pipeline" });
    } catch (error) {
      next(error);
    }
  };

  // DELETE /api/forms/submissions/:id
  archiveSubmission = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await formsService.archiveSubmission(clinicId, userId, req.params.id as string);
      res.status(200).json({ status: "success", message: "Submission archived" });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/forms
  createForm = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const id = await formsService.createForm(clinicId, userId, req.body);
      res.status(201).json({ status: "success", data: { id } });
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/forms/:id
  updateForm = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await formsService.updateForm(clinicId, userId, req.params.id as string, req.body);
      res.status(200).json({ status: "success", message: "Form updated successfully" });
    } catch (error) {
      next(error);
    }
  };

  // DELETE /api/forms/:id
  deleteForm = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await formsService.deleteForm(clinicId, userId, req.params.id as string);
      res.status(200).json({ status: "success", message: "Form deleted successfully" });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/public/forms/:id
  getPublicForm = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const form = await formsService.getPublicForm(req.params.id as string);
      res.status(200).json({ status: "success", data: form });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/public/forms/:id/submit
  submitPublic = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const apiKeyCtx = (req as any).apiKey;
      const submission = apiKeyCtx
        ? await formsService.submitFormPublic(
            apiKeyCtx.clinicId as string,
            req.params.id as string,
            req.body,
            req.headers,
          )
        : await formsService.submitHostedPublicForm(req.params.id as string, req.body, req.headers);
      res.status(201).json({ status: "success", data: submission });
    } catch (error) {
      next(error);
    }
  };
}

export const formsController = new FormsController();
