import { Router } from "express";
import { auditLogController } from "./audit-log.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { listAuditLogValidator } from "./audit-log.validators.js";

const router = Router();

router.use(authenticate);

// @route   GET /api/audit-log
// @desc    List clinic-scoped audit log entries
// @access  Private
router.get(
  "/",
  authorizePermission("audit:read"),
  listAuditLogValidator,
  validate,
  auditLogController.listAuditLog,
);

export default router;
