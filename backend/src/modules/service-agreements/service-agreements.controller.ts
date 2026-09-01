import { Request, Response, NextFunction } from "express";
import { serviceAgreementsService } from "./service-agreements.service.js";

export class ServiceAgreementsController {
  generate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const data = await serviceAgreementsService.generateAgreement({
        ...req.body,
        clinicId: user.clinicId,
        userId: user.userId,
      });
      res.status(201).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const data = await serviceAgreementsService.getAgreement(clinicId, req.params.id as string);
      res.status(200).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  };

  approveForSend = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const data = await serviceAgreementsService.approveForExternalSend(user.clinicId, user.userId, req.params.id as string);
      res.status(200).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  };

  attachSignatureEvidence = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const data = await serviceAgreementsService.attachSignatureEvidence({
        clinicId: user.clinicId,
        userId: user.userId,
        agreementId: req.params.id as string,
        signatureEvidenceId: req.body.signatureEvidenceId,
        acceptedPdfSha256: req.body.acceptedPdfSha256,
      });
      res.status(200).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  };

  triggerQuickBooks = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const data = await serviceAgreementsService.triggerQuickBooksOnce(user.clinicId, user.userId, req.params.id as string);
      res.status(200).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  };

  unlockOnboarding = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const data = await serviceAgreementsService.unlockOnboardingAfterClearedPayment({
        clinicId: user.clinicId,
        userId: user.userId,
        agreementId: req.params.id as string,
        paymentStatus: req.body.paymentStatus,
        authenticated: req.body.authenticated,
        clearedAt: req.body.clearedAt,
      });
      res.status(200).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  };
}

export const serviceAgreementsController = new ServiceAgreementsController();
