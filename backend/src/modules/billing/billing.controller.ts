import { Request, Response, NextFunction } from "express";
import { billingService } from "./billing.service.js";

export class BillingController {
  // GET /api/billing/status
  // Return subscription and usage data for the current clinic
  getStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const status = await billingService.getBillingStatus(clinicId);
      res.status(200).json({ status: "success", data: status });
    } catch (error) {
      next(error);
    }
  };

  // Create a checkout session
  createSession = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const { cancelUrl, mode, planType, returnUrl, successUrl, trialDays } = req.body;
      const result = await billingService.createCheckoutSession(clinicId, planType, {
        cancelUrl,
        mode,
        returnUrl,
        successUrl,
        trialDays,
      });
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  };

  getCheckoutSessionStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const sessionId = String(req.params.sessionId || "");
      const status = await billingService.getCheckoutSessionStatus(clinicId, sessionId);
      res.status(200).json({ status: "success", data: status });
    } catch (error) {
      next(error);
    }
  };

  // Cancel subscription
  cancelSubscription = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      await billingService.cancelSubscription(clinicId);
      res.status(200).json({ 
        status: "success", 
        message: "Subscription will be canceled at the end of the billing period" 
      });
    } catch (error) {
      next(error);
    }
  };

  
  // Webhook handler
  // Note: This requires the raw request body for signature verification
  handleWebhook = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const signature = req.headers["stripe-signature"] as string;
      const rawBody = (req as any).rawBody; // We will set this up in Step 6
      
      await billingService.handleWebhook(rawBody, signature);
      
      res.status(200).send({ received: true });
    } catch (error) {
      // For webhooks, we usually want to return a 400 if it fails
      res.status(400).send(`Webhook Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
}

export const billingController = new BillingController();
