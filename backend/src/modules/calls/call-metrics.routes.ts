import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { callsController } from "./calls.controller.js";

const router = Router();

router.use(authenticate);

// @route   GET /api/metrics/calls/staff
// @desc    Read staff call handling metrics
// @access  Private
router.get("/calls/staff", authorizePermission("reports:read"), callsController.getStaffMetrics);

export default router;
