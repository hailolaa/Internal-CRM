import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizeAnyPermission, authorizePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { proposalsController } from "./proposals.controller.js";
import {
  createProposalValidator,
  listProposalsValidator,
  proposalIdParamValidator,
  proposalPublicTokenParamValidator,
  proposalStatusUpdateValidator,
  proposalSourceDataValidator,
  sendProposalValidator,
  updateProposalValidator,
} from "./proposals.validators.js";

const router = Router();

router.get(
  "/shared/:token",
  proposalPublicTokenParamValidator,
  validate,
  proposalsController.getSharedProposal,
);

router.use(authenticate);

router.get(
  "/",
  authorizePermission("proposals:read"),
  listProposalsValidator,
  validate,
  proposalsController.listProposals,
);

router.post(
  "/",
  authorizePermission("proposals:write"),
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
  authorizePermission("proposals:read"),
  proposalIdParamValidator,
  validate,
  proposalsController.getProposal,
);

router.post(
  "/:id/share",
  authorizePermission("proposals:write"),
  proposalIdParamValidator,
  validate,
  proposalsController.createProposalShare,
);

router.post(
  "/:id/send",
  authorizePermission("proposals:write"),
  sendProposalValidator,
  validate,
  proposalsController.markProposalSent,
);

router.post(
  "/:id/status",
  authorizePermission("proposals:write"),
  proposalStatusUpdateValidator,
  validate,
  proposalsController.updateProposalStatus,
);

router.patch(
  "/:id",
  authorizePermission("proposals:write"),
  updateProposalValidator,
  validate,
  proposalsController.updateProposal,
);

router.delete(
  "/:id",
  authorizePermission("proposals:write"),
  proposalIdParamValidator,
  validate,
  proposalsController.archiveProposal,
);

export default router;
