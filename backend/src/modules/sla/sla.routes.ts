import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { slaController } from "./sla.controller.js";

const router = Router();

router.use(authenticate);

// @route   GET /api/sla/summary
// @desc    Read clinic SLA summary metrics
// @access  Private
router.get("/summary", authorizePermission("contacts:read"), slaController.getSummary);

// @route   GET /api/sla/leads
// @desc    List uncontacted leads with SLA state
// @access  Private
router.get("/leads", authorizePermission("contacts:read"), slaController.listLeadQueue);

// @route   GET /api/sla/breaches
// @desc    List stored SLA breaches
// @access  Private
router.get("/breaches", authorizePermission("contacts:read"), slaController.listBreaches);

// @route   POST /api/sla/check-breaches
// @desc    Manually run the clinic-scoped SLA breach detector
// @access  Private
router.post("/check-breaches", authorizePermission("contacts:write"), slaController.checkBreaches);

export default router;
