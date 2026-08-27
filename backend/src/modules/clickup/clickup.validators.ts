import { body, param, query } from "express-validator";

const mappingStatuses = ["active", "needs_review", "archived"];
const mappingSources = ["manual", "oauth_lookup", "api_lookup"];
const syncDirections = ["mission_control_to_clickup", "clickup_to_mission_control", "manual"];
const categoryKeys = ["development", "seo", "gmb_local_seo", "ppc", "managerial", "reporting", "account_control"];
const missionControlPriorities = ["low", "medium", "high", "urgent"];

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

export const clickUpProvisionIdParamValidator = [
  param("provisionId").isUUID().withMessage("A valid ClickUp delivery provision ID is required"),
];

export const completeClickUpOAuthValidator = [
  body("code").isString().trim().notEmpty().withMessage("ClickUp OAuth code is required"),
  body("state").isString().trim().notEmpty().withMessage("ClickUp OAuth state is required"),
  body("workspaceId").optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 64 }),
];

export const clientAccountProfileIdParamValidator = [
  param("clientAccountProfileId").isString().trim().notEmpty().isLength({ max: 36 }),
];

export const clickUpMappingIdParamValidator = [
  param("mappingId").isString().trim().notEmpty().isLength({ max: 36 }),
];

export const clickUpEventIdParamValidator = [
  param("eventId").isString().trim().notEmpty().isLength({ max: 36 }),
];


export const clickUpLookupQueryValidator = [
  query("workspaceId").optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 64 }),
  query("spaceId").optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 64 }),
  query("folderId").optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 64 }),
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

export const saveClickUpCategoryMappingValidator = [
  ...clientAccountProfileIdParamValidator,
  requiredExternalId("workspaceId", "ClickUp workspace ID"),
  requiredExternalId("spaceId", "ClickUp space ID"),
  optionalExternalId("connectionId", "ClickUp connection ID"),
  optionalExternalId("folderId", "ClickUp folder ID"),
  requiredExternalId("listId", "ClickUp list ID"),
  body("categoryKey").isIn(categoryKeys).withMessage("Work category is not supported"),
  body("defaultAssigneeIds").optional().isArray({ max: 20 }).withMessage("Default assignees must be a list"),
  body("defaultAssigneeIds.*").optional().isString().trim().isLength({ min: 1, max: 64 }),
  body("mappingStatus").optional().isIn(mappingStatuses),
  body("mappingSource").optional().isIn(mappingSources),
];

export const saveClickUpPriorityMappingValidator = [
  body("missionControlPriority").isIn(missionControlPriorities),
  body("clickupPriority").isInt({ min: 1, max: 4 }).toInt(),
];

export const createClickUpTaskValidator = [
  body("internalTaskId").isUUID().withMessage("A valid Mission Control task ID is required"),
  body("categoryKey").isIn(categoryKeys).withMessage("A supported work category is required"),
  body("title").isString().trim().isLength({ min: 1, max: 255 }).withMessage("Title is required"),
  body("description").optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 20000 }),
  body("dueDate").optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage("Due date must be valid"),
  body("priority").isIn(missionControlPriorities),
  body("assigneeIds").optional().isArray({ max: 20 }),
  body("assigneeIds.*").optional().isString().trim().isLength({ min: 1, max: 64 }),
  body("links").optional().isArray({ max: 20 }),
  body("links.*.label").optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 120 }),
  body("links.*.url").optional().isURL({ require_protocol: true }).withMessage("Each relevant link must be a valid URL"),
];
