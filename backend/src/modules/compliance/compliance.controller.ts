import { Request, Response, NextFunction } from "express";
import { complianceService } from "./compliance.service.js";

export class ComplianceController {
  // GET /api/compliance/documents
  // List compliance documents
  listDocuments = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const documents = await complianceService.listDocuments(clinicId);
      res.status(200).json({ status: "success", data: documents });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/compliance/documents
  // Create a compliance document
  createDocument = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const id = await complianceService.createDocument(clinicId, userId, req.body);
      res.status(201).json({ status: "success", data: { id } });
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/compliance/documents/:id
  // Update a compliance document
  updateDocument = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await complianceService.updateDocument(clinicId, userId, req.params.id as string, req.body);
      res.status(200).json({ status: "success", message: "Compliance document updated successfully" });
    } catch (error) {
      next(error);
    }
  };

  // DELETE /api/compliance/documents/:id
  // Soft delete a compliance document
  deleteDocument = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await complianceService.deleteDocument(clinicId, userId, req.params.id as string);
      res.status(200).json({ status: "success", message: "Compliance document deleted successfully" });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/compliance/settings
  // Read data protection settings
  getSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const settings = await complianceService.getSettings(clinicId);
      res.status(200).json({ status: "success", data: settings });
    } catch (error) {
      next(error);
    }
  };

  // PUT /api/compliance/settings
  // Update data protection settings
  updateSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const settings = await complianceService.updateSettings(clinicId, userId, req.body);
      res.status(200).json({ status: "success", data: settings });
    } catch (error) {
      next(error);
    }
  };

  uploadDocumentFile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const file = await complianceService.uploadDocumentFile(clinicId, userId, req.params.id as string, req.body);
      res.status(201).json({ status: "success", data: file });
    } catch (error) {
      next(error);
    }
  };

  getDocumentFile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const file = await complianceService.getDocumentFile(clinicId, userId, req.params.id as string);
      res.status(200).json({ status: "success", data: file });
    } catch (error) {
      next(error);
    }
  };

  deleteDocumentFile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await complianceService.deleteDocumentFile(clinicId, userId, req.params.id as string);
      res.status(200).json({ status: "success", message: "Compliance document file deleted successfully" });
    } catch (error) {
      next(error);
    }
  };

  listDataAccessRequests = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const requests = await complianceService.listDataAccessRequests(clinicId);
      res.status(200).json({ status: "success", data: requests });
    } catch (error) {
      next(error);
    }
  };

  createDataAccessRequest = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const request = await complianceService.createDataAccessRequest(clinicId, userId, req.body);
      res.status(201).json({ status: "success", data: request });
    } catch (error) {
      next(error);
    }
  };

  updateDataAccessRequest = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const request = await complianceService.updateDataAccessRequest(clinicId, userId, req.params.id as string, req.body);
      res.status(200).json({ status: "success", data: request });
    } catch (error) {
      next(error);
    }
  };

  archiveDataAccessRequest = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await complianceService.archiveDataAccessRequest(clinicId, userId, req.params.id as string);
      res.status(200).json({ status: "success", message: "Data access request archived successfully" });
    } catch (error) {
      next(error);
    }
  };
}

export const complianceController = new ComplianceController();
