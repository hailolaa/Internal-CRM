import { Request, Response, NextFunction } from "express";
import { integrationsService } from "./integrations.service.js";
import { config } from "../../config/index.js";

function redirectConnectorOAuth(res: Response, type: string, params: Record<string, string>) {
  const frontendUrl = config.frontendUrl.replace(/\/$/, "");
  const query = new URLSearchParams({ connector: type, ...params });
  res.redirect(`${frontendUrl}/app/integrations?${query.toString()}`);
}

export class IntegrationsController {
  // GET /api/integrations
  // List all integrations configured for the clinic
  listIntegrations = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const integrations = await integrationsService.listIntegrations(clinicId);
      res.status(200).json({ status: "success", data: integrations });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/integrations/connectors/status
  // List setup and health state for marketing intelligence connectors
  listConnectorStatuses = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const statuses = await integrationsService.listConnectorStatuses(clinicId);
      res.status(200).json({ status: "success", data: statuses });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/integrations/connectors/definitions
  // List supported Phase 1 connector vendors and required setup fields
  listConnectorDefinitions = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const definitions = integrationsService.listConnectorDefinitions();
      res.status(200).json({ status: "success", data: definitions });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/integrations/connectors/:type/accounts
  // List provider accounts/properties/locations accessible through stored OAuth tokens
  listConnectorAccountChoices = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const choices = await integrationsService.listConnectorAccountChoices(
        clinicId,
        req.params.type as any,
      );
      res.status(200).json({ status: "success", data: choices });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/integrations/connectors/:type/accounts/select
  // Save the selected provider account/property/location for the active clinic
  selectConnectorAccount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const status = await integrationsService.selectConnectorAccount(
        clinicId,
        userId,
        req.params.type as any,
        req.body,
      );
      res.status(200).json({ status: "success", data: status });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/integrations/connectors/:type/oauth/start
  // Start a tenant-scoped OAuth handoff for supported marketplace vendors
  startConnectorOAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const result = await integrationsService.startConnectorOAuth(
        clinicId,
        userId,
        req.params.type as any,
        req.body,
      );
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/integrations/connectors/:type/oauth/callback
  // Complete a frontend-assisted OAuth callback handoff
  completeConnectorOAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const status = await integrationsService.completeConnectorOAuth(
        clinicId,
        userId,
        req.params.type as any,
        req.body,
      );
      res.status(200).json({ status: "success", data: status });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/integrations/connectors/:type/oauth/callback
  // Complete the provider browser callback and redirect back to the integrations UI
  completeConnectorOAuthRedirect = async (req: Request, res: Response) => {
    const type = String(req.params.type || "");
    const code = String(req.query.code || "");
    const state = String(req.query.state || "");
    const providerError = String(req.query.error || "");

    try {
      if (providerError) {
        throw new Error(providerError);
      }
      await integrationsService.completeConnectorOAuthRedirect(type as any, { code, state });
      redirectConnectorOAuth(res, type, { oauth: "connected" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "OAuth connector setup failed";
      redirectConnectorOAuth(res, type, { oauth: "error", message });
    }
  };

  // POST /api/integrations/connectors/:type/setup
  // Save connector OAuth/setup metadata and expose actionable health state
  setupConnector = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const status = await integrationsService.setupConnector(
        clinicId,
        userId,
        req.params.type as any,
        req.body,
      );
      res.status(200).json({ status: "success", data: status });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/integrations/connectors/:type/sync
  // Ingest connector metric rows or record a sync failure
  syncConnector = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const result = await integrationsService.syncConnector(
        clinicId,
        userId,
        req.params.type as any,
        req.body,
      );
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/integrations
  // Create or activate an integration placeholder
  connectIntegration = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const id = await integrationsService.connectIntegration(clinicId, userId, req.body);
      res.status(201).json({ status: "success", data: { id } });
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/integrations/:id
  // Update connection status or safe integration metadata
  updateIntegration = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await integrationsService.updateIntegration(
        clinicId,
        userId,
        req.params.id as string,
        req.body,
      );
      res.status(200).json({
        status: "success",
        message: "Integration updated successfully",
      });
    } catch (error) {
      next(error);
    }
  };
}

export const integrationsController = new IntegrationsController();
