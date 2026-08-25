import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { missionControlApiController } from "./mission-control-api.controller.js";

const router = Router();

router.use(authenticate);
router.use(authorizePermission("mission_control_api:read"));

router.get("/health", missionControlApiController.health);
router.get("/version", missionControlApiController.version);
router.get("/capabilities", missionControlApiController.capabilities);
router.get("/search", missionControlApiController.search);
router.get("/records/:type/:id", missionControlApiController.fetchRecord);

export default router;
