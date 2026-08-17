import { Router } from "express";
import multer from "multer";
import { config } from "../../config/index.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize, authorizeAnyPermission, authorizePermission } from "../../middleware/authorize.js";
import { oauthRateLimit } from "../../middleware/rateLimit.js";
import { validate } from "../../middleware/validate.js";
import { ApiError } from "../../utils/ApiError.js";
import { clickUpController } from "./clickup.controller.js";
import {
  clickUpOAuthCallbackValidator,
  clickUpLookupQueryValidator,
  clientAccountProfileIdParamValidator,
  completeClickUpOAuthValidator,
  createClickUpTaskValidator,
  listClickUpTaskMappingsValidator,
  saveClickUpCategoryMappingValidator,
  saveClickUpClientMappingValidator,
  saveClickUpPriorityMappingValidator,
  saveClickUpTaskMappingValidator,
  clickUpMappingIdParamValidator,
} from "./clickup.validators.js";

const router = Router();
const clickUpTaskUpload = multer({ storage: multer.memoryStorage(), limits: { files: 5, fileSize: config.taskUploads.maxFileSizeBytes } });
const receiveClickUpTaskFiles = (req: any, res: any, next: any) => {
  clickUpTaskUpload.array("attachments", 5)(req, res, (error: any) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return next(ApiError.badRequest("Each ClickUp attachment must be 20 MB or smaller."));
    }
    return next(ApiError.badRequest(error.message || "The ClickUp task files could not be received."));
  });
};
const parseClickUpTaskPayload = (req: any, res: any, next: any) => {
  if (typeof req.body?.payload !== "string") return next();
  try {
    req.body = JSON.parse(req.body.payload);
    return next();
  } catch {
    return next(ApiError.badRequest("ClickUp task payload must be valid JSON."));
  }
};

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
  "/api-token/connect",
  oauthRateLimit,
  authorize("SUPER_ADMIN", "ADMIN"),
  clickUpController.connectConfiguredApiToken,
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
  "/remote/workspaces",
  authorize("SUPER_ADMIN", "ADMIN"),
  clickUpController.listWorkspaces,
);

router.get(
  "/remote/spaces",
  authorize("SUPER_ADMIN", "ADMIN"),
  clickUpLookupQueryValidator,
  validate,
  clickUpController.listSpaces,
);

router.get(
  "/remote/folders",
  authorize("SUPER_ADMIN", "ADMIN"),
  clickUpLookupQueryValidator,
  validate,
  clickUpController.listFolders,
);

router.get(
  "/remote/lists",
  authorize("SUPER_ADMIN", "ADMIN"),
  clickUpLookupQueryValidator,
  validate,
  clickUpController.listLists,
);

router.get(
  "/remote/members",
  authorize("SUPER_ADMIN", "ADMIN"),
  clickUpLookupQueryValidator,
  validate,
  clickUpController.listMembers,
);

router.get(
  "/operations-dashboard",
  authorizePermission("internal_tasks:read"),
  clickUpController.getOperationsDashboard,
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
  "/category-mappings/:clientAccountProfileId",
  authorizePermission("client_accounts:read"),
  clientAccountProfileIdParamValidator,
  validate,
  clickUpController.listCategoryMappings,
);

router.put(
  "/category-mappings/:clientAccountProfileId",
  authorizePermission("client_accounts:write"),
  saveClickUpCategoryMappingValidator,
  validate,
  clickUpController.saveCategoryMapping,
);

router.get(
  "/priority-mappings",
  authorize("SUPER_ADMIN", "ADMIN"),
  clickUpController.listPriorityMappings,
);

router.put(
  "/priority-mappings",
  authorize("SUPER_ADMIN", "ADMIN"),
  saveClickUpPriorityMappingValidator,
  validate,
  clickUpController.savePriorityMapping,
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

router.post(
  "/tasks/create",
  authorizePermission("internal_tasks:write"),
  receiveClickUpTaskFiles,
  parseClickUpTaskPayload,
  createClickUpTaskValidator,
  validate,
  clickUpController.createClickUpTask,
);

router.get(
  "/reconciliation/failed-tasks",
  authorizePermission("internal_tasks:read"),
  clickUpController.listFailedTaskMappings,
);

router.post(
  "/reconciliation/failed-tasks/:mappingId/replay",
  authorizePermission("internal_tasks:write"),
  clickUpMappingIdParamValidator,
  validate,
  clickUpController.replayFailedTaskMapping,
);

router.post(
  "/reconciliation/failed-tasks/:mappingId/dismiss",
  authorizePermission("internal_tasks:write"),
  clickUpMappingIdParamValidator,
  validate,
  clickUpController.dismissFailedTaskMapping,
);

export default router;
