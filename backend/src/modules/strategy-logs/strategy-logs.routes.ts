import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { strategyLogsController } from "./strategy-logs.controller.js";
import {
  createStrategyLogValidator,
  listStrategyLogsValidator,
  logIdParamValidator,
  updateStrategyLogValidator,
} from "./strategy-logs.validators.js";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  authorizePermission("strategy_logs:read"),
  listStrategyLogsValidator,
  validate,
  strategyLogsController.listLogs,
);

router.post(
  "/",
  authorizePermission("strategy_logs:write"),
  createStrategyLogValidator,
  validate,
  strategyLogsController.createLog,
);

router.patch(
  "/:id",
  authorizePermission("strategy_logs:write"),
  updateStrategyLogValidator,
  validate,
  strategyLogsController.updateLog,
);

router.post(
  "/:id/archive",
  authorizePermission("strategy_logs:write"),
  logIdParamValidator,
  validate,
  strategyLogsController.archiveLog,
);

export default router;
