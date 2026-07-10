import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { clientAccountsController } from "./client-accounts.controller.js";
import {
  clientAccountServiceIdParamValidator,
  createClientAccountFromContactValidator,
  createClientAccountValidator,
  createClientAccountServiceValidator,
  listClientAccountsValidator,
  listClientAccountServicesValidator,
  updateClientAccountProfileValidator,
  updateClientAccountServiceValidator,
} from "./client-accounts.validators.js";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  authorizePermission("client_accounts:read"),
  listClientAccountsValidator,
  validate,
  clientAccountsController.listAccounts,
);

router.post(
  "/",
  authorizePermission("client_accounts:write"),
  createClientAccountValidator,
  validate,
  clientAccountsController.createAccount,
);

router.post(
  "/from-contact",
  authorizePermission("client_accounts:write"),
  createClientAccountFromContactValidator,
  validate,
  clientAccountsController.createAccountFromContact,
);

router.get(
  "/profile",
  authorizePermission("client_accounts:read"),
  clientAccountsController.getProfile,
);

router.patch(
  "/profile",
  authorizePermission("client_accounts:write"),
  updateClientAccountProfileValidator,
  validate,
  clientAccountsController.updateProfile,
);

router.get(
  "/services",
  authorizePermission("client_accounts:read"),
  listClientAccountServicesValidator,
  validate,
  clientAccountsController.listServices,
);

router.post(
  "/services",
  authorizePermission("client_accounts:write"),
  createClientAccountServiceValidator,
  validate,
  clientAccountsController.createService,
);

router.patch(
  "/services/:serviceId",
  authorizePermission("client_accounts:write"),
  updateClientAccountServiceValidator,
  validate,
  clientAccountsController.updateService,
);

router.post(
  "/services/:serviceId/archive",
  authorizePermission("client_accounts:write"),
  clientAccountServiceIdParamValidator,
  validate,
  clientAccountsController.archiveService,
);

export default router;
