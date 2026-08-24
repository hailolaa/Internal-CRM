import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { directDebitController } from "./direct-debit.controller.js";
import {
  createDirectDebitMandateSetupValidator,
  directDebitProviderCallbackValidator,
  reconcileDirectDebitMandatesValidator,
} from "./direct-debit.validators.js";

const router = Router();

router.post(
  "/provider-callback",
  directDebitProviderCallbackValidator,
  validate,
  directDebitController.handleProviderCallback,
);

router.use(authenticate);

router.post(
  "/mandates/setup",
  authorizePermission("billing:write"),
  createDirectDebitMandateSetupValidator,
  validate,
  directDebitController.createMandateSetup,
);

router.post(
  "/reconciliation/run",
  authorizePermission("billing:write"),
  reconcileDirectDebitMandatesValidator,
  validate,
  directDebitController.reconcileMandates,
);

export default router;
