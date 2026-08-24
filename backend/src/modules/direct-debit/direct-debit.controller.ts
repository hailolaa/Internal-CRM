import { Request, Response, NextFunction } from "express";
import { config } from "../../config/index.js";
import { ApiError } from "../../utils/ApiError.js";
import { directDebitService } from "./direct-debit.service.js";

function getWebhookSecretHeader(req: Request) {
  const value = req.headers["x-direct-debit-webhook-secret"] || req.headers["x-gocardless-webhook-secret"];
  if (Array.isArray(value)) return value[0] || "";
  return typeof value === "string" ? value : "";
}

export class DirectDebitController {
  createMandateSetup = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const mandate = await directDebitService.createMandateSetup({
        clinicId,
        provider: req.body.provider,
        clientAccountProfileId: req.body.clientAccountProfileId,
        providerCustomerId: req.body.providerCustomerId,
        setupReference: req.body.setupReference,
        setupUrl: req.body.setupUrl,
        metadata: req.body.metadata,
      });
      res.status(201).json({ status: "success", data: mandate });
    } catch (error) {
      next(error);
    }
  };

  handleProviderCallback = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!config.directDebit.webhookSecret) {
        throw ApiError.serviceUnavailable("Direct Debit provider callbacks are not configured.");
      }
      if (getWebhookSecretHeader(req) !== config.directDebit.webhookSecret) {
        throw ApiError.unauthorized("Invalid Direct Debit provider callback signature.");
      }

      const result = await directDebitService.applyProviderCallback({
        clinicId: req.body.clinicId,
        provider: req.body.provider,
        providerEventId: req.body.providerEventId,
        providerMandateId: req.body.providerMandateId,
        status: req.body.status,
        eventType: req.body.eventType,
        providerCustomerId: req.body.providerCustomerId,
        failureReason: req.body.failureReason,
        payload: req.body.payload || req.body,
      });
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  };

  reconcileMandates = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const result = await directDebitService.reconcileMandates({
        clinicId,
        provider: req.body.provider,
        providerStatuses: req.body.providerStatuses,
      });
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  };
}

export const directDebitController = new DirectDebitController();
