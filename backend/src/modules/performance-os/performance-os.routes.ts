import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { performanceOsController } from "./performance-os.controller.js";
import {
  attributionChainValidator,
  listPerformanceAlertsValidator,
} from "./performance-os.validators.js";

const router = Router();

router.use(authenticate);

router.get(
  "/attribution-chain",
  authorizePermission("reports:read"),
  attributionChainValidator,
  validate,
  performanceOsController.getAttributionChain,
);

router.get(
  "/alerts",
  authorizePermission("reports:read"),
  listPerformanceAlertsValidator,
  validate,
  performanceOsController.listAlerts,
);

export default router;
