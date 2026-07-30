import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize, authorizeAnyPermission, authorizePermission } from "../../middleware/authorize.js";
import { oauthRateLimit } from "../../middleware/rateLimit.js";
import { validate } from "../../middleware/validate.js";
import { clickUpController } from "./clickup.controller.js";
import {
  clickUpOAuthCallbackValidator,
  clientAccountProfileIdParamValidator,
  completeClickUpOAuthValidator,
  listClickUpTaskMappingsValidator,
  saveClickUpClientMappingValidator,
  saveClickUpTaskMappingValidator,
} from "./clickup.validators.js";

const router = Router();

router.get(
  "/oauth/callback",
  oauthRateLimit,
  clickUpOAuthCallbackValidator,
  validate,
  clickUpController.completeOAuthRedirect,
);

router.use(authenticate);

router.get(
  "/status",
  authorizePermission("webhooks:read"),
  clickUpController.getStatus,
);

router.post(
  "/oauth/start",
  authorize("SUPER_ADMIN", "ADMIN"),
  clickUpController.startOAuth,
);

router.post(
  "/oauth/callback",
  authorize("SUPER_ADMIN", "ADMIN"),
  completeClickUpOAuthValidator,
  validate,
  clickUpController.completeOAuth,
);

router.post(
  "/revoke",
  authorize("SUPER_ADMIN", "ADMIN"),
  clickUpController.revoke,
);

router.get(
  "/client-mappings/:clientAccountProfileId",
  authorizePermission("client_accounts:read"),
  clientAccountProfileIdParamValidator,
  validate,
  clickUpController.getClientMapping,
);

router.put(
  "/client-mappings/:clientAccountProfileId",
  authorizePermission("client_accounts:write"),
  saveClickUpClientMappingValidator,
  validate,
  clickUpController.saveClientMapping,
);

router.delete(
  "/client-mappings/:clientAccountProfileId",
  authorizePermission("client_accounts:write"),
  clientAccountProfileIdParamValidator,
  validate,
  clickUpController.deleteClientMapping,
);

router.get(
  "/task-mappings",
  authorizeAnyPermission("internal_tasks:read", "client_accounts:read"),
  listClickUpTaskMappingsValidator,
  validate,
  clickUpController.listTaskMappings,
);

router.post(
  "/task-mappings",
  authorizeAnyPermission("internal_tasks:write", "client_accounts:write"),
  saveClickUpTaskMappingValidator,
  validate,
  clickUpController.saveTaskMapping,
);

export default router;
