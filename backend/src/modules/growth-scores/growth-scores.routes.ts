import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizeAnyPermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { growthScoresController } from "./growth-scores.controller.js";
import {
  createGrowthScoreOutcomeFeedbackValidator,
  createGrowthScoreSnapshotValidator,
  listGrowthScoreSnapshotsValidator,
} from "./growth-scores.validators.js";

const router = Router();

router.use(authenticate);

router.get(
  "/portfolio",
  authorizeAnyPermission("reports:read", "client_accounts:read"),
  growthScoresController.getPortfolio,
);

router.get(
  "/snapshots",
  authorizeAnyPermission("contacts:read", "client_accounts:read"),
  listGrowthScoreSnapshotsValidator,
  validate,
  growthScoresController.listSnapshots,
);

router.post(
  "/snapshots",
  authorizeAnyPermission("contacts:write", "client_accounts:write"),
  createGrowthScoreSnapshotValidator,
  validate,
  growthScoresController.createSnapshot,
);

router.post(
  "/outcome-feedback",
  authorizeAnyPermission("client_accounts:write", "reports:write"),
  createGrowthScoreOutcomeFeedbackValidator,
  validate,
  growthScoresController.createOutcomeFeedback,
);

export default router;
