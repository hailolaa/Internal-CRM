import { Router } from "express";
import multer from "multer";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize, authorizePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { clientAccountsController } from "./client-accounts.controller.js";
import {
  clientAccountClinicIdParamValidator,
  clientAccountContactIdParamValidator,
  clientAccountContactLinkValidator,
  clientAccountServiceIdParamValidator,
  createClientAccountFromContactValidator,
  createClientAccountDriveFolderValidator,
  createClientAccountValidator,
  createClientAccountServiceValidator,
  listClientAccountsValidator,
  listClientAccountDriveFoldersValidator,
  listClientAccountServicesValidator,
  updateClientAccountDriveFolderValidator,
  updateClientAccountProfileValidator,
  updateClientAccountServiceValidator,
  uploadClientAccountDriveFileValidator,
  clientAccountDriveFileValidator,
  renameClientAccountDriveFileValidator,
} from "./client-accounts.validators.js";

const router = Router();
const driveUpload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: 25 * 1024 * 1024 },
});

router.use(authenticate);

router.get(
  "/drive/oauth/status",
  authorizePermission("client_accounts:read"),
  clientAccountsController.getDriveOAuthStatus,
);

router.post(
  "/drive/oauth/start",
  authorize("SUPER_ADMIN", "ADMIN"),
  clientAccountsController.startDriveOAuth,
);

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
  "/contacts/:contactId/links",
  authorizePermission("client_accounts:read"),
  clientAccountContactIdParamValidator,
  validate,
  clientAccountsController.listContactClientAccountLinks,
);

router.patch(
  "/:clinicId/drive-folder",
  authorize("SUPER_ADMIN", "ADMIN"),
  updateClientAccountDriveFolderValidator,
  validate,
  clientAccountsController.updateDriveFolder,
);

router.get(
  "/:clinicId/drive/folders",
  authorizePermission("client_accounts:read"),
  listClientAccountDriveFoldersValidator,
  validate,
  clientAccountsController.listDriveFolders,
);

router.post(
  "/:clinicId/drive/folders",
  authorizePermission("client_accounts:write"),
  createClientAccountDriveFolderValidator,
  validate,
  clientAccountsController.createDriveFolder,
);

router.post(
  "/:clinicId/drive/files",
  authorizePermission("client_accounts:write"),
  driveUpload.single("file"),
  uploadClientAccountDriveFileValidator,
  validate,
  clientAccountsController.uploadDriveFile,
);

router.get(
  "/:clinicId/drive/files/:fileId/download",
  authorizePermission("client_accounts:read"),
  clientAccountDriveFileValidator,
  validate,
  clientAccountsController.downloadDriveFile,
);

router.patch(
  "/:clinicId/drive/files/:fileId",
  authorizePermission("client_accounts:write"),
  renameClientAccountDriveFileValidator,
  validate,
  clientAccountsController.renameDriveFile,
);

router.delete(
  "/:clinicId/drive/files/:fileId",
  authorizePermission("client_accounts:write"),
  clientAccountDriveFileValidator,
  validate,
  clientAccountsController.deleteDriveFile,
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
