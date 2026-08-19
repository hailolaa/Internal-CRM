import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { missedCallRecoveryController } from "./missed-call-recovery.controller.js";
import {
  createClinicGrowerMappingValidator,
  updateClinicGrowerMappingValidator,
  updateMissedCallRecoveryStateValidator,
} from "./missed-call-recovery.validators.js";

const router = Router();

router.use(authenticate);

router.get("/", authorizePermission("calls:read"), missedCallRecoveryController.listRecoveries);

router.get(
  "/mappings",
  authorizePermission("client_accounts:read"),
  missedCallRecoveryController.listMappings,
);

router.post(
  "/mappings",
  authorizePermission("client_accounts:write"),
  createClinicGrowerMappingValidator,
  validate,
  missedCallRecoveryController.createMapping,
);

router.patch(
  "/mappings/:id",
  authorizePermission("client_accounts:write"),
  updateClinicGrowerMappingValidator,
  validate,
  missedCallRecoveryController.updateMapping,
);

router.patch(
  "/:id/state",
  authorizePermission("calls:write"),
  updateMissedCallRecoveryStateValidator,
  validate,
  missedCallRecoveryController.updateState,
);

export default router;
