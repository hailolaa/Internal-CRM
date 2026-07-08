import { Router } from "express";
import { apiKeysController } from "./api-keys.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { apiKeyIdParamValidator, createApiKeyValidator, updateApiKeyValidator } from "./api-keys.validators.js";

const router = Router();

router.use(authenticate);

// @route   GET /api/settings/api-keys
// @desc    List API keys for the clinic
// @access  Private
router.get("/", authorizePermission("settings:read"), apiKeysController.listApiKeys);

// @route   POST /api/settings/api-keys
// @desc    Create a new API key and return the secret once
// @access  Private
router.post(
  "/",
  authorizePermission("settings:write"),
  createApiKeyValidator,
  validate,
  apiKeysController.createApiKey,
);

// @route   PATCH /api/settings/api-keys/:id
// @desc    Update API key metadata
// @access  Private
router.patch(
  "/:id",
  authorizePermission("settings:write"),
  updateApiKeyValidator,
  validate,
  apiKeysController.updateApiKey,
);

// @route   DELETE /api/settings/api-keys/:id
// @desc    Revoke an API key
// @access  Private
router.delete(
  "/:id",
  authorizePermission("settings:write"),
  apiKeyIdParamValidator,
  validate,
  apiKeysController.revokeApiKey,
);

export default router;
