import { Router } from "express";
import { authenticateApiKey } from "../../middleware/apiKeyAuthenticate.js";
import { websiteLeadsController } from "./website-leads.controller.js";

const router = Router();

router.post("/", authenticateApiKey, websiteLeadsController.capture);

export default router;
