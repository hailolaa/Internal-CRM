import { Router } from "express";
import { authenticateApiKey } from "../../middleware/apiKeyAuthenticate.js";
import { formsController } from "./forms.controller.js";

const router = Router();

function optionalApiKey(req: any, res: any, next: any) {
  const hasApiKey =
    req.headers.authorization?.startsWith("Bearer ") || req.get("x-api-key");
  if (!hasApiKey) {
    next();
    return;
  }
  authenticateApiKey(req, res, next);
}

// Public form definition endpoint: GET /api/public/forms/:id
router.get("/:id", formsController.getPublicForm);

// Public submission endpoint: POST /api/public/forms/:id/submit
router.post("/:id/submit", optionalApiKey, formsController.submitPublic);

export default router;
