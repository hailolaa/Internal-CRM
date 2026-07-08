import { Router } from "express";
import { integrationsController } from "./integrations.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { oauthRateLimit } from "../../middleware/rateLimit.js";
import { validate } from "../../middleware/validate.js";
import {
  connectIntegrationValidator,
  completeConnectorOAuthValidator,
  connectorTypeParamValidator,
  selectConnectorAccountValidator,
  setupConnectorValidator,
  startConnectorOAuthValidator,
  syncConnectorValidator,
  updateIntegrationValidator,
} from "./integrations.validators.js";

const router = Router();

// @route   GET /api/integrations/connectors/:type/oauth/callback
// @desc    Complete provider browser OAuth callback for marketing connectors
// @access  Provider callback with stored state validation
router.get(
  "/connectors/:type/oauth/callback",
  oauthRateLimit,
  connectorTypeParamValidator,
  validate,
  integrationsController.completeConnectorOAuthRedirect,
);

router.use(authenticate);

// @route   GET /api/integrations
// @desc    List clinic integrations
// @access  Private
router.get(
  "/",
  authorizePermission("webhooks:read"),
  integrationsController.listIntegrations,
);

// @route   GET /api/integrations/connectors/status
// @desc    Marketing connector setup, sync health, freshness, and fallback status
// @access  Private
router.get(
  "/connectors/status",
  authorizePermission("webhooks:read"),
  integrationsController.listConnectorStatuses,
);

// @route   GET /api/integrations/connectors/definitions
// @desc    Supported Phase 1 connector vendors and setup fields
// @access  Private
router.get(
  "/connectors/definitions",
  authorizePermission("webhooks:read"),
  integrationsController.listConnectorDefinitions,
);

// @route   GET /api/integrations/connectors/:type/accounts
// @desc    List provider account choices for an OAuth-connected connector
// @access  Private
router.get(
  "/connectors/:type/accounts",
  authorizePermission("webhooks:read"),
  connectorTypeParamValidator,
  validate,
  integrationsController.listConnectorAccountChoices,
);

// @route   POST /api/integrations/connectors/:type/accounts/select
// @desc    Save selected provider account/property/location
// @access  Private
router.post(
  "/connectors/:type/accounts/select",
  authorizePermission("webhooks:write"),
  selectConnectorAccountValidator,
  validate,
  integrationsController.selectConnectorAccount,
);

// @route   POST /api/integrations/connectors/:type/oauth/start
// @desc    Start connector OAuth handoff
// @access  Private
router.post(
  "/connectors/:type/oauth/start",
  authorizePermission("webhooks:write"),
  startConnectorOAuthValidator,
  validate,
  integrationsController.startConnectorOAuth,
);

// @route   POST /api/integrations/connectors/:type/oauth/callback
// @desc    Complete connector OAuth handoff
// @access  Private
router.post(
  "/connectors/:type/oauth/callback",
  authorizePermission("webhooks:write"),
  completeConnectorOAuthValidator,
  validate,
  integrationsController.completeConnectorOAuth,
);

// @route   POST /api/integrations/connectors/:type/setup
// @desc    Save connector setup/OAuth metadata
// @access  Private
router.post(
  "/connectors/:type/setup",
  authorizePermission("webhooks:write"),
  setupConnectorValidator,
  validate,
  integrationsController.setupConnector,
);

// @route   POST /api/integrations/connectors/:type/sync
// @desc    Sync/import connector metrics and update health
// @access  Private
router.post(
  "/connectors/:type/sync",
  authorizePermission("webhooks:write"),
  syncConnectorValidator,
  validate,
  integrationsController.syncConnector,
);

// @route   POST /api/integrations
// @desc    Connect or create an integration placeholder
// @access  Private
router.post(
  "/",
  authorizePermission("webhooks:write"),
  connectIntegrationValidator,
  validate,
  integrationsController.connectIntegration,
);

// @route   PATCH /api/integrations/:id
// @desc    Update an integration
// @access  Private
router.patch(
  "/:id",
  authorizePermission("webhooks:write"),
  updateIntegrationValidator,
  validate,
  integrationsController.updateIntegration,
);

export default router;
