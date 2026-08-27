import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize, authorizeAnyPermission, authorizePermission } from "../../middleware/authorize.js";
import { oauthRateLimit } from "../../middleware/rateLimit.js";
import { validate } from "../../middleware/validate.js";
import { quickBooksController } from "./quickbooks.controller.js";
import {
  clientAccountProfileIdParamValidator,
  listQuickBooksCustomersValidator,
  quickBooksOAuthCallbackValidator,
  quickBooksCommercialDraftIdParamValidator,
  saveQuickBooksClientCustomerMappingValidator,
} from "./quickbooks.validators.js";

const router = Router();

router.get(
  "/oauth/callback",
  oauthRateLimit,
  quickBooksOAuthCallbackValidator,
  validate,
  quickBooksController.completeOAuthRedirect,
);

router.use(authenticate);

router.get(
  "/status",
  authorizeAnyPermission("client_accounts:read", "settings:read"),
  quickBooksController.getStatus,
);

router.post(
  "/oauth/start",
  authorize("SUPER_ADMIN", "ADMIN", "FINANCE"),
  quickBooksController.startOAuth,
);

router.post(
  "/revoke",
  authorize("SUPER_ADMIN", "ADMIN", "FINANCE"),
  quickBooksController.revoke,
);

router.post(
  "/commercial-drafts/:draftId/process",
  authorizePermission("billing:write"),
  quickBooksCommercialDraftIdParamValidator,
  validate,
  quickBooksController.processCommercialDraft,
);

router.get(
  "/customers",
  authorizeAnyPermission("client_accounts:read", "settings:read"),
  listQuickBooksCustomersValidator,
  validate,
  quickBooksController.listCustomers,
);

router.get(
  "/client-mappings/:clientAccountProfileId",
  authorizePermission("client_accounts:read"),
  clientAccountProfileIdParamValidator,
  validate,
  quickBooksController.getClientMapping,
);

router.put(
  "/client-mappings/:clientAccountProfileId",
  authorizePermission("client_accounts:write"),
  saveQuickBooksClientCustomerMappingValidator,
  validate,
  quickBooksController.saveClientMapping,
);

router.delete(
  "/client-mappings/:clientAccountProfileId",
  authorizePermission("client_accounts:write"),
  clientAccountProfileIdParamValidator,
  validate,
  quickBooksController.deleteClientMapping,
);

export default router;
