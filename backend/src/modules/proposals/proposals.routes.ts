import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizeAnyPermission, authorizePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { proposalsController } from "./proposals.controller.js";
import {
  createProofAssetValidator,
  createProposalValidator,
  createProposalSignatureRequestValidator,
  exportProposalsValidator,
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

router.get(
  "/export/csv",
  authorizePermission("proposals:read"),
  exportProposalsValidator,
  validate,
  proposalsController.exportProposalsCsv,
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
  "/templates",
  authorizePermission("proposals:read"),
  proposalsController.listProposalTemplates,
);

router.get(
  "/proof-assets",
  authorizePermission("proposals:read"),
  proposalsController.listProofAssets,
);

router.post(
  "/proof-assets",
  authorizePermission("proposals:write"),
  createProofAssetValidator,
  validate,
  proposalsController.createProofAsset,
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

router.get(
  "/:id/signature-requests",
  authorizePermission("proposals:read"),
  proposalIdParamValidator,
  validate,
  proposalsController.listSignatureRequests,
);

router.post(
  "/:id/signature-requests",
  authorizePermission("proposals:write"),
  createProposalSignatureRequestValidator,
  validate,
  proposalsController.createSignatureRequest,
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
