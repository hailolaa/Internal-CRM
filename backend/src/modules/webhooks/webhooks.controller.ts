import { Request, Response, NextFunction } from "express";
import { ApiError } from "../../utils/ApiError.js";
import { config } from "../../config/index.js";
import { webhooksService } from "./webhooks.service.js";
import { callsService } from "../calls/calls.service.js";

export class WebhooksController {
  private assertTwilioWebhookAllowed(req: Request) {
    if (!config.twilio.webhookSecret) return;

    const provided = String(req.get("x-webhook-secret") || req.query.secret || "");
    if (provided !== config.twilio.webhookSecret) {
      throw ApiError.unauthorized("Invalid Twilio webhook secret");
    }
  }

  // POST /api/webhooks/twilio/calls
  handleTwilioCall = async (req: Request, res: Response, next: NextFunction) => {
    try {
      this.assertTwilioWebhookAllowed(req);
      const data = await callsService.handleTwilioCallWebhook(req.body || {});
      res.status(200).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/webhooks/twilio/recordings
  handleTwilioRecording = async (req: Request, res: Response, next: NextFunction) => {
    try {
      this.assertTwilioWebhookAllowed(req);
      const data = await callsService.handleTwilioRecordingWebhook(req.body || {});
      res.status(200).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/webhooks/endpoints
  // List webhook endpoints
  listEndpoints = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const endpoints = await webhooksService.listEndpoints(clinicId);
      res.status(200).json({ status: "success", data: endpoints });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/webhooks/endpoints
  // Create a webhook endpoint
  createEndpoint = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const id = await webhooksService.createEndpoint(clinicId, userId, req.body);
      res.status(201).json({ status: "success", data: { id } });
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/webhooks/endpoints/:id
  // Update a webhook endpoint
  updateEndpoint = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await webhooksService.updateEndpoint(clinicId, userId, req.params.id as string, req.body);
      res.status(200).json({ status: "success", message: "Webhook endpoint updated successfully" });
    } catch (error) {
      next(error);
    }
  };

  // DELETE /api/webhooks/endpoints/:id
  // Soft delete a webhook endpoint
  deleteEndpoint = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await webhooksService.deleteEndpoint(clinicId, userId, req.params.id as string);
      res.status(200).json({ status: "success", message: "Webhook endpoint deleted successfully" });
    } catch (error) {
      next(error);
    }
  };
}

export const webhooksController = new WebhooksController();
