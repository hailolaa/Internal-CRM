import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { serviceAgreementsController } from "./service-agreements.controller.js";
import {
  attachSignatureEvidenceValidator,
  generateServiceAgreementValidator,
  serviceAgreementIdParamValidator,
  unlockOnboardingValidator,
} from "./service-agreements.validators.js";

const router = Router();

router.use(authenticate);

router.post(
  "/",
  authorizePermission("service_agreements:write"),
  generateServiceAgreementValidator,
  validate,
  serviceAgreementsController.generate,
);

router.get(
  "/:id",
  authorizePermission("service_agreements:read"),
  serviceAgreementIdParamValidator,
  validate,
  serviceAgreementsController.get,
);

router.post(
  "/:id/max-approval",
  authorizePermission("service_agreements:approve"),
  serviceAgreementIdParamValidator,
  validate,
  serviceAgreementsController.approveForSend,
);

router.post(
  "/:id/signature-evidence",
  authorizePermission("service_agreements:write"),
  attachSignatureEvidenceValidator,
  validate,
  serviceAgreementsController.attachSignatureEvidence,
);

router.post(
  "/:id/quickbooks",
  authorizePermission("service_agreements:write"),
  serviceAgreementIdParamValidator,
  validate,
  serviceAgreementsController.triggerQuickBooks,
);

router.post(
  "/:id/onboarding/unlock",
  authorizePermission("service_agreements:write"),
  unlockOnboardingValidator,
  validate,
  serviceAgreementsController.unlockOnboarding,
);

export default router;
