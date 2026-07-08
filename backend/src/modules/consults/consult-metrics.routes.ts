import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { consultsController } from "./consults.controller.js";

const router = Router();

router.use(authenticate);

router.get(
  "/consults/summary",
  authorizePermission("appointments:read"),
  consultsController.getSummary,
);

router.get(
  "/practitioners/conversion",
  authorizePermission("appointments:read"),
  consultsController.getPractitionerConversion,
);

export default router;
