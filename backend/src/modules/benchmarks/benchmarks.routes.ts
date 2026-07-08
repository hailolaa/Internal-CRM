import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { benchmarksController } from "./benchmarks.controller.js";

const router = Router();

router.use(authenticate);

router.get("/summary", authorizePermission("reports:read"), benchmarksController.getSummary);

export default router;
