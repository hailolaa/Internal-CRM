import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { backgroundJobsController } from "./background-jobs.controller.js";
import { updateBackgroundJobStatusValidator } from "./background-jobs.validators.js";

const router = Router();

router.use(authenticate);

// @route   GET /api/background-jobs
// @desc    List configured background jobs and backup runs
// @access  Private
router.get("/", authorizePermission("settings:read"), backgroundJobsController.listJobs);

// @route   PATCH /api/background-jobs/:id/status
// @desc    Pause or resume a scheduler job
// @access  Private
router.patch(
  "/:id/status",
  authorizePermission("settings:write"),
  updateBackgroundJobStatusValidator,
  validate,
  backgroundJobsController.updateStatus,
);

export default router;
