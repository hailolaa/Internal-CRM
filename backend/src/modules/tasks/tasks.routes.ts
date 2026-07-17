import { Router } from "express";
import multer from "multer";
import { body, param } from "express-validator";
import { config } from "../../config/index.js";
import { ApiError } from "../../utils/ApiError.js";
import { tasksController } from "./tasks.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import {
  createInternalTaskValidator,
  createTaskValidator,
  listInternalTasksValidator,
  taskIdParamValidator,
  updateInternalTaskValidator,
  updateInternalTaskQaValidator,
  updateTaskValidator,
} from "./tasks.validators.js";

const router = Router();
const taskUpload = multer({ storage: multer.memoryStorage(), limits: { files: 1, fileSize: config.taskUploads.maxFileSizeBytes } });
const receiveTaskAttachment = (req: any, res: any, next: any) => {
  taskUpload.single("file")(req, res, (error: any) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return next(ApiError.badRequest("The file exceeds the 20 MB upload limit"));
    }
    return next(ApiError.badRequest(error.message || "The file could not be uploaded"));
  });
};
const workspaceParams = [param("id").isUUID().withMessage("A valid task id is required")];
const attachmentParams = [...workspaceParams, param("attachmentId").isUUID().withMessage("A valid attachment id is required")];

router.use(authenticate);

// @route   GET /api/tasks
// @desc    List clinic tasks
// @access  Private
router.get("/", authorizePermission("events:read"), tasksController.listTasks);

// @route   POST /api/tasks
// @desc    Create a clinic task
// @access  Private
router.post("/", authorizePermission("events:write"), createTaskValidator, validate, tasksController.createTask);

// @route   GET /api/tasks/internal
// @desc    List Clinic Grower internal delivery tasks
// @access  Private(internal tasks permission)
router.get(
  "/internal",
  authorizePermission("internal_tasks:read"),
  listInternalTasksValidator,
  validate,
  tasksController.listInternalTasks,
);

// @route   POST /api/tasks/internal
// @desc    Create a Clinic Grower internal delivery task
// @access  Private(internal tasks permission)
router.post(
  "/internal",
  authorizePermission("internal_tasks:write"),
  createInternalTaskValidator,
  validate,
  tasksController.createInternalTask,
);

router.get("/internal/:id", authorizePermission("internal_tasks:read"), workspaceParams, validate, tasksController.getInternalTask);
router.get("/internal/:id/comments", authorizePermission("internal_tasks:read"), workspaceParams, validate, tasksController.listTaskComments);
router.post(
  "/internal/:id/comments",
  authorizePermission("internal_tasks:write"),
  [...workspaceParams, body("body").isString().trim().isLength({ min: 1, max: 10000 }), body("mentionedUserIds").optional().isArray({ max: 20 }), body("mentionedUserIds.*").optional().isUUID()],
  validate,
  tasksController.createTaskComment,
);
router.delete(
  "/internal/:id/comments/:commentId",
  authorizePermission("internal_tasks:write"),
  [...workspaceParams, param("commentId").isUUID()],
  validate,
  tasksController.deleteTaskComment,
);
router.get("/internal/:id/attachments", authorizePermission("internal_tasks:read"), workspaceParams, validate, tasksController.listTaskAttachments);
router.post("/internal/:id/attachments", authorizePermission("internal_tasks:write"), workspaceParams, validate, receiveTaskAttachment, tasksController.uploadTaskAttachment);
router.get("/internal/:id/attachments/:attachmentId/file", authorizePermission("internal_tasks:read"), attachmentParams, validate, tasksController.downloadTaskAttachment);
router.delete("/internal/:id/attachments/:attachmentId", authorizePermission("internal_tasks:write"), attachmentParams, validate, tasksController.deleteTaskAttachment);
router.get("/internal/:id/activity", authorizePermission("internal_tasks:read"), workspaceParams, validate, tasksController.listTaskActivity);

// @route   PATCH /api/tasks/internal/:id
// @desc    Update a Clinic Grower internal delivery task
// @access  Private(internal tasks permission)
router.patch(
  "/internal/:id",
  authorizePermission("internal_tasks:write"),
  updateInternalTaskValidator,
  validate,
  tasksController.updateInternalTask,
);

// @route   PATCH /api/tasks/internal/:id/qa
// @desc    Update lightweight QA state for an internal delivery task
// @access  Private(internal tasks permission)
router.patch(
  "/internal/:id/qa",
  authorizePermission("internal_tasks:write"),
  updateInternalTaskQaValidator,
  validate,
  tasksController.updateInternalTaskQa,
);

// @route   POST /api/tasks/internal/:id/archive
// @desc    Archive a Clinic Grower internal delivery task
// @access  Private(internal tasks permission)
router.post(
  "/internal/:id/archive",
  authorizePermission("internal_tasks:write"),
  taskIdParamValidator,
  validate,
  tasksController.archiveInternalTask,
);

// @route   PATCH /api/tasks/:id
// @desc    Update a clinic task
// @access  Private
router.patch("/:id", authorizePermission("events:write"), updateTaskValidator, validate, tasksController.updateTask);

// @route   DELETE /api/tasks/:id
// @desc    Soft delete a clinic task
// @access  Private
router.delete("/:id", authorizePermission("events:write"), taskIdParamValidator, validate, tasksController.deleteTask);

export default router;
