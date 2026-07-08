import { Router } from "express";
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
