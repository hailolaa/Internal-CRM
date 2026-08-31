import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { missionControlApiRateLimit } from "../../middleware/rateLimit.js";
import { missionControlApiController } from "./mission-control-api.controller.js";
import { requireMissionControlIntegrationScope } from "./mission-control-integration-auth.js";

const router = Router();

router.use(missionControlApiRateLimit);
router.use(authenticate);
router.use(requireMissionControlIntegrationScope("mission_control_api:read"));
router.use(authorizePermission("mission_control_api:read"));

router.get("/health", missionControlApiController.health);
router.get("/version", missionControlApiController.version);
router.get("/capabilities", missionControlApiController.capabilities);
router.get("/search", missionControlApiController.search);
router.get("/records/:type/:id", missionControlApiController.fetchRecord);

export default router;
