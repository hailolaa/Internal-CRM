import { body, param, query } from "express-validator";

const mappingStatuses = ["active", "needs_review", "archived"];
const mappingSources = ["manual", "oauth_lookup", "api_lookup"];
const syncDirections = ["mission_control_to_clickup", "clickup_to_mission_control", "manual"];

const optionalExternalId = (field: string, label: string) =>
  body(field)
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 64 })
    .withMessage(`${label} must be 64 characters or fewer`)
    .matches(/^[A-Za-z0-9._:-]+$/)
    .withMessage(`${label} contains unsupported characters`);

const requiredExternalId = (field: string, label: string) =>
  body(field)
    .trim()
    .notEmpty()
    .withMessage(`${label} is required`)
    .isLength({ max: 64 })
    .withMessage(`${label} must be 64 characters or fewer`)
    .matches(/^[A-Za-z0-9._:-]+$/)
    .withMessage(`${label} contains unsupported characters`);

export const clickUpOAuthCallbackValidator = [
  query("code").isString().trim().notEmpty().withMessage("ClickUp OAuth code is required"),
  query("state").isString().trim().notEmpty().withMessage("ClickUp OAuth state is required"),
  query("workspaceId").optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 64 }),
];

export const completeClickUpOAuthValidator = [
  body("code").isString().trim().notEmpty().withMessage("ClickUp OAuth code is required"),
  body("state").isString().trim().notEmpty().withMessage("ClickUp OAuth state is required"),
  body("workspaceId").optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 64 }),
];

export const clientAccountProfileIdParamValidator = [
  param("clientAccountProfileId").isString().trim().notEmpty().isLength({ max: 36 }),
];

export const saveClickUpClientMappingValidator = [
  ...clientAccountProfileIdParamValidator,
  requiredExternalId("workspaceId", "ClickUp workspace ID"),
  optionalExternalId("connectionId", "ClickUp connection ID"),
  optionalExternalId("spaceId", "ClickUp space ID"),
  optionalExternalId("folderId", "ClickUp folder ID"),
  optionalExternalId("listId", "ClickUp list ID"),
  optionalExternalId("deliveryRootTaskId", "ClickUp delivery task ID"),
  body("workspaceName").optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 255 }),
  body("deliveryUrl").optional({ nullable: true, checkFalsy: true }).trim().isURL().withMessage("Delivery URL must be valid").isLength({ max: 1000 }),
  body("mappingStatus").optional().isIn(mappingStatuses),
  body("mappingSource").optional().isIn(mappingSources),
  body().custom((value) => {
    if (value.spaceId || value.folderId || value.listId || value.deliveryRootTaskId) return true;
    throw new Error("A ClickUp space, folder, list, or delivery task ID is required for deterministic client mapping");
  }),
];

export const saveClickUpTaskMappingValidator = [
  body("clientAccountProfileId").isString().trim().notEmpty().isLength({ max: 36 }),
  requiredExternalId("workspaceId", "ClickUp workspace ID"),
  requiredExternalId("clickupTaskId", "ClickUp task ID"),
  optionalExternalId("internalTaskId", "Internal task ID"),
  optionalExternalId("connectionId", "ClickUp connection ID"),
  optionalExternalId("clickupListId", "ClickUp list ID"),
  body("clickupUrl").optional({ nullable: true, checkFalsy: true }).trim().isURL().withMessage("ClickUp URL must be valid").isLength({ max: 1000 }),
  body("syncDirection").optional().isIn(syncDirections),
  body("mappingStatus").optional().isIn(mappingStatuses),
];

export const listClickUpTaskMappingsValidator = [
  query("clientAccountProfileId").isString().trim().notEmpty().isLength({ max: 36 }),
];
