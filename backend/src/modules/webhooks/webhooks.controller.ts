import { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
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

function extractWhatsAppPhoneNumberIds(body: any) {
  const ids = new Set<string>();

  if (body?.phoneNumberId) ids.add(String(body.phoneNumberId));
  if (body?.metadata?.phone_number_id) ids.add(String(body.metadata.phone_number_id));

  for (const entry of body?.entry || []) {
    for (const change of entry.changes || []) {
      const phoneNumberId = change.value?.metadata?.phone_number_id;
      if (phoneNumberId) ids.add(String(phoneNumberId));
    }
  }

  return Array.from(ids).map((id) => id.trim()).filter(Boolean);
}

function constantTimeEquals(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  return aBuffer.length === bBuffer.length && crypto.timingSafeEqual(aBuffer, bBuffer);
}

function metaSignatureFor(rawBody: Buffer, appSecret: string) {
  return `sha256=${crypto
    .createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex")}`;
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
    if (!config.whatsapp.appSecret) {
      throw ApiError.serviceUnavailable("WhatsApp app secret is not configured");
    }

    const rawBody = (req as any).rawBody;
    if (!Buffer.isBuffer(rawBody)) {
      throw ApiError.badRequest("Raw WhatsApp webhook body is required for signature validation");
    }

    const provided = String(req.get("x-hub-signature-256") || "");
    if (!provided) {
      throw ApiError.unauthorized("Missing WhatsApp webhook signature");
    }

    const expected = metaSignatureFor(rawBody, config.whatsapp.appSecret);
    if (!constantTimeEquals(provided, expected)) {
      throw ApiError.unauthorized("Invalid WhatsApp webhook signature");
    }
  }

  private resolveWhatsAppWorkspaceId(req: Request) {
    const phoneNumberIds = extractWhatsAppPhoneNumberIds(req.body || {});
    if (phoneNumberIds.length > 1) {
      throw ApiError.badRequest("WhatsApp webhook must contain messages for a single receiving phone number");
    }

    const phoneNumberId = phoneNumberIds[0] || "";
    if (phoneNumberId) {
      const mappedWorkspaceId =
        config.whatsapp.webhookWorkspaceMap[phoneNumberId] ||
        (phoneNumberId === config.whatsapp.phoneNumberId ? config.whatsapp.defaultWorkspaceId : "");

      if (!mappedWorkspaceId) {
        throw ApiError.forbidden("WhatsApp phone number is not mapped to an internal workspace");
      }

      return mappedWorkspaceId;
    }

    throw ApiError.badRequest("WhatsApp receiving phone number is required for webhook tenant routing");
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
      const clinicId = this.resolveWhatsAppWorkspaceId(req);

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
