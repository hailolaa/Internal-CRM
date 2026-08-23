import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { fleetIngestionController } from "./fleet-ingestion.controller.js";
import { fleetEventIdParamValidator, fleetSyncExceptionParamValidator } from "./fleet-ingestion.validators.js";

const router = Router();

router.use(authenticate);

router.get(
  "/sync-health",
  authorizePermission("reports:read"),
  fleetIngestionController.getSyncAdministration,
);

router.post(
  "/sync-health/dead-letter/:eventId/replay",
  authorizePermission("reports:write"),
  fleetEventIdParamValidator,
  validate,
  fleetIngestionController.replayDeadLetterEvent,
);

router.post(
  "/sync-health/exceptions/:type/:exceptionId/resolve",
  authorizePermission("reports:write"),
  fleetSyncExceptionParamValidator,
  validate,
  fleetIngestionController.resolveSyncException,
);

export default router;
