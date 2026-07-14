import { Request, Response, NextFunction } from "express";
import { ApiError } from "../../utils/ApiError.js";
import { config } from "../../config/index.js";
import { webhooksService } from "./webhooks.service.js";
import { callsService } from "../calls/calls.service.js";
import { whatsappAiService } from "../comms/whatsapp-ai.service.js";

function splitDisplayName(value: unknown) {
  const name = String(value || "").trim();
  if (!name) return { firstName: null, lastName: null };
  const [firstName, ...rest] = name.split(/\s+/);
  return { firstName, lastName: rest.join(" ") || null };
}

function extractWhatsAppInboundMessages(body: any) {
  const messages: any[] = [];

  if (Array.isArray(body?.entry)) {
    for (const entry of body.entry) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        const contacts = Array.isArray(value.contacts) ? value.contacts : [];
        for (const message of value.messages || []) {
          const contact = contacts.find((item: any) => item.wa_id === message.from) || contacts[0] || {};
          const { firstName, lastName } = splitDisplayName(contact.profile?.name);
          messages.push({
            providerMessageId: message.id || null,
            from: message.from || contact.wa_id,
            body: message.text?.body || "",
            receivedAt: message.timestamp
              ? new Date(Number(message.timestamp) * 1000).toISOString()
              : null,
            firstName,
            lastName,
            createLeadIfMissing: true,
          });
        }
      }
    }
  }

  if (messages.length) return messages;

  const { firstName, lastName } = splitDisplayName(body?.ProfileName || body?.profileName);
  return [
    {
      providerMessageId: body?.providerMessageId || body?.messageId || body?.MessageSid || null,
      from: body?.from || body?.From || body?.waId || body?.WaId,
      body: body?.body || body?.Body || body?.text || "",
      receivedAt: body?.receivedAt || null,
      contactId: body?.contactId || null,
      firstName: body?.firstName || firstName,
      lastName: body?.lastName || lastName,
      accountName: body?.accountName || null,
      createLeadIfMissing: Boolean(body?.createLeadIfMissing),
    },
  ];
}

export class WebhooksController {
  private assertTwilioWebhookAllowed(req: Request) {
    if (!config.twilio.webhookSecret) return;

    const provided = String(req.get("x-webhook-secret") || req.query.secret || "");
    if (provided !== config.twilio.webhookSecret) {
      throw ApiError.unauthorized("Invalid Twilio webhook secret");
    }
  }

  private assertWhatsAppWebhookAllowed(req: Request) {
    if (!config.whatsapp.webhookSecret) return;

    const provided = String(req.get("x-webhook-secret") || req.query.secret || "");
    if (provided !== config.whatsapp.webhookSecret) {
      throw ApiError.unauthorized("Invalid WhatsApp webhook secret");
    }
  }

  private getWhatsAppWorkspaceId(req: Request) {
    return String(
      req.get("x-workspace-id") ||
        req.get("x-clinic-id") ||
        req.query.workspaceId ||
        req.query.clinicId ||
        req.body?.workspaceId ||
        req.body?.clinicId ||
        "",
    );
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

  // POST /api/webhooks/whatsapp/inbound
  handleWhatsAppInbound = async (req: Request, res: Response, next: NextFunction) => {
    try {
      this.assertWhatsAppWebhookAllowed(req);
      const clinicId = this.getWhatsAppWorkspaceId(req);
      if (!clinicId) throw ApiError.badRequest("Workspace id is required for WhatsApp inbound webhooks");

      const inboundMessages = extractWhatsAppInboundMessages(req.body || {});
      if (!inboundMessages.length || !inboundMessages.some((message) => message.from && message.body)) {
        throw ApiError.badRequest("WhatsApp inbound webhook did not include a readable message");
      }

      const data = [];
      for (const message of inboundMessages) {
        if (!message.from || !message.body) continue;
        data.push(await whatsappAiService.ingestInbound(clinicId, null, message));
      }

      res.status(200).json({ status: "success", data: data.length === 1 ? data[0] : data });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/webhooks/whatsapp/inbound
  handleWhatsAppVerify = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const mode = String(req.query["hub.mode"] || "");
      const token = String(req.query["hub.verify_token"] || "");
      const challenge = String(req.query["hub.challenge"] || "");

      if (mode !== "subscribe" || !challenge) {
        throw ApiError.badRequest("Invalid WhatsApp webhook verification request");
      }

      if (!config.whatsapp.verifyToken || token !== config.whatsapp.verifyToken) {
        throw ApiError.unauthorized("Invalid WhatsApp webhook verify token");
      }

      res.status(200).send(challenge);
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
