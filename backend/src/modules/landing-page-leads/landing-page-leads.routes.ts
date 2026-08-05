import { Router } from "express";
import { authenticateApiKey } from "../../middleware/apiKeyAuthenticate.js";
import { landingPageLeadRateLimit } from "../../middleware/rateLimit.js";
import { landingPageLeadsController } from "./landing-page-leads.controller.js";

const router = Router();

router.post(
  "/",
  landingPageLeadRateLimit,
  authenticateApiKey,
  landingPageLeadsController.capture,
);

export default router;
