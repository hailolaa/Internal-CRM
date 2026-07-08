import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { opsLogsController } from "./ops-logs.controller.js";

const router = Router();

router.use(authenticate);

// @route   GET /api/metrics/roas
// @desc    Read ROAS and cost-per-conversion metrics
// @access  Private
router.get("/roas", authorizePermission("reports:read"), opsLogsController.getRoasMetrics);

// @route   GET /api/metrics/campaigns
// @desc    Read campaign spend and conversion metrics
// @access  Private
router.get("/campaigns", authorizePermission("reports:read"), opsLogsController.getCampaignMetrics);

export default router;
