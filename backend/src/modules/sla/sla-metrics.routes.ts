import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { slaController } from "./sla.controller.js";

const router = Router();

router.use(authenticate);

// @route   GET /api/metrics/response-time
// @desc    Read response-time metrics by source
// @access  Private
router.get("/response-time", authorizePermission("reports:read"), slaController.getResponseTimeMetrics);

// @route   GET /api/metrics/staff-response
// @desc    Read staff first-response metrics
// @access  Private
router.get("/staff-response", authorizePermission("reports:read"), slaController.getStaffResponseMetrics);

export default router;
