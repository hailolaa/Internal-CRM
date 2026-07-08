import { Request, Response, NextFunction } from "express";
import { onboardingService } from "./onboarding.service.js";

export class OnboardingController {
  getStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clinicId = (req as any).user.clinicId as string;
      const status = await onboardingService.getStatus(clinicId);
      res.status(200).json({ status: "success", data: status });
    } catch (error) {
      next(error);
    }
  };

  patchStep = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clinicId = (req as any).user.clinicId as string;
      const userId = (req as any).user.userId as string;
      const { step, payload } = req.body;
      const result = await onboardingService.patchStep(clinicId, userId, step, payload);
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  };

  complete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clinicId = (req as any).user.clinicId as string;
      const userId = (req as any).user.userId as string;
      const result = await onboardingService.completeOnboarding(clinicId, userId);
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  };
}

export const onboardingController = new OnboardingController();
