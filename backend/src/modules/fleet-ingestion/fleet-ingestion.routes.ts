import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { fleetIngestionController } from "./fleet-ingestion.controller.js";
import { fleetEventIdParamValidator, fleetSyncExceptionActionValidator } from "./fleet-ingestion.validators.js";

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
  "/sync-health/exceptions/:type/:exceptionId/acknowledge",
  authorizePermission("reports:write"),
  fleetSyncExceptionActionValidator,
  validate,
  fleetIngestionController.acknowledgeSyncException,
);

router.post(
  "/sync-health/exceptions/:type/:exceptionId/resolve",
  authorizePermission("reports:write"),
  fleetSyncExceptionActionValidator,
  validate,
  fleetIngestionController.resolveSyncException,
);

router.post(
  "/sync-health/exceptions/:type/:exceptionId/dismiss",
  authorizePermission("reports:write"),
  fleetSyncExceptionActionValidator,
  validate,
  fleetIngestionController.dismissSyncException,
);

export default router;
