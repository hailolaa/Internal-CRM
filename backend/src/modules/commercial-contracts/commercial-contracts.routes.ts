import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { commercialContractsController } from "./commercial-contracts.controller.js";
import {
  commercialContractIdParamValidator,
  createCommercialContractChangeOrderValidator,
  createCommercialContractNoticeAlertsValidator,
  createCommercialContractValidator,
  generateCommercialContractRenewalsValidator,
  listCommercialContractAlertsValidator,
  listCommercialContractsValidator,
  transitionCommercialContractValidator,
} from "./commercial-contracts.validators.js";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  authorizePermission("client_accounts:read"),
  listCommercialContractsValidator,
  validate,
  commercialContractsController.listContracts,
);

router.post(
  "/",
  authorizePermission("client_accounts:write"),
  createCommercialContractValidator,
  validate,
  commercialContractsController.createContract,
);

router.get(
  "/alerts",
  authorizePermission("client_accounts:read"),
  listCommercialContractAlertsValidator,
  validate,
  commercialContractsController.listAlerts,
);

router.post(
  "/alerts/notice",
  authorizePermission("client_accounts:write"),
  createCommercialContractNoticeAlertsValidator,
  validate,
  commercialContractsController.createNoticeAlerts,
);

router.post(
  "/renewals",
  authorizePermission("client_accounts:write"),
  generateCommercialContractRenewalsValidator,
  validate,
  commercialContractsController.generateRenewals,
);

router.get(
  "/:id",
  authorizePermission("client_accounts:read"),
  commercialContractIdParamValidator,
  validate,
  commercialContractsController.getContract,
);

router.patch(
  "/:id/status",
  authorizePermission("client_accounts:write"),
  transitionCommercialContractValidator,
  validate,
  commercialContractsController.transitionContract,
);

router.post(
  "/:id/change-orders",
  authorizePermission("client_accounts:write"),
  createCommercialContractChangeOrderValidator,
  validate,
  commercialContractsController.createChangeOrder,
);

export default router;
