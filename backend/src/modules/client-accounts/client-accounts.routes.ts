import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { clientAccountsController } from "./client-accounts.controller.js";
import {
  clientAccountClinicIdParamValidator,
  clientAccountContactLinkValidator,
  clientAccountServiceIdParamValidator,
  createClientAccountFromContactValidator,
  createClientAccountValidator,
  createClientAccountServiceValidator,
  listClientAccountsValidator,
  listClientAccountServicesValidator,
  updateClientAccountDriveFolderValidator,
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

router.patch(
  "/:clinicId/drive-folder",
  authorizePermission("client_accounts:write"),
  updateClientAccountDriveFolderValidator,
  validate,
  clientAccountsController.updateDriveFolder,
);

router.get(
  "/:clinicId/linked-records",
  authorizePermission("client_accounts:read"),
  clientAccountClinicIdParamValidator,
  validate,
  clientAccountsController.getLinkedRecords,
);

router.post(
  "/:clinicId/contacts/:contactId/link",
  authorizePermission("client_accounts:write"),
  clientAccountContactLinkValidator,
  validate,
  clientAccountsController.linkContact,
);

router.post(
  "/:clinicId/contacts/:contactId/unlink",
  authorizePermission("client_accounts:write"),
  clientAccountContactLinkValidator,
  validate,
  clientAccountsController.unlinkContact,
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
