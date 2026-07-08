import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { onboardingController } from "./onboarding.controller.js";

const router = Router();
router.use(authenticate);

// Read onboarding status
router.get("/status", authorizePermission("onboarding:read"), onboardingController.getStatus);

// Patch a single step
router.patch("/step", authorizePermission("onboarding:write"), onboardingController.patchStep);

// Complete onboarding
router.post("/complete", authorizePermission("onboarding:write"), onboardingController.complete);

export default router;
