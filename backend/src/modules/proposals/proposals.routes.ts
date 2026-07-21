import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizeAnyPermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { proposalsController } from "./proposals.controller.js";
import {
  createProposalValidator,
  listProposalsValidator,
  proposalIdParamValidator,
  proposalSourceDataValidator,
  updateProposalValidator,
} from "./proposals.validators.js";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  authorizeAnyPermission("proposals:read", "contacts:read", "client_accounts:read"),
  listProposalsValidator,
  validate,
  proposalsController.listProposals,
);

router.post(
  "/",
  authorizeAnyPermission("proposals:write", "contacts:write", "client_accounts:write"),
  createProposalValidator,
  validate,
  proposalsController.createProposal,
);

router.get(
  "/source-data",
  authorizeAnyPermission("proposals:read", "contacts:read", "client_accounts:read"),
  proposalSourceDataValidator,
  validate,
  proposalsController.getProposalSourceData,
);

router.get(
  "/:id",
  authorizeAnyPermission("proposals:read", "contacts:read", "client_accounts:read"),
  proposalIdParamValidator,
  validate,
  proposalsController.getProposal,
);

router.patch(
  "/:id",
  authorizeAnyPermission("proposals:write", "contacts:write", "client_accounts:write"),
  updateProposalValidator,
  validate,
  proposalsController.updateProposal,
);

router.delete(
  "/:id",
  authorizeAnyPermission("proposals:write", "contacts:write", "client_accounts:write"),
  proposalIdParamValidator,
  validate,
  proposalsController.archiveProposal,
);

export default router;
