import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizeAnyPermission, authorizePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { proposalDiscoveryController } from "./proposal-discovery.controller.js";
import {
  proposalDiscoverySessionIdParamValidator,
  startProposalDiscoverySessionValidator,
  updateProposalDiscoverySessionValidator,
} from "./proposal-discovery.validators.js";
import { proposalsController } from "./proposals.controller.js";
import {
  createProofAssetValidator,
  createProposalValidator,
  createProposalSignatureRequestValidator,
  exportProposalsValidator,
  listProposalsValidator,
  proposalIdParamValidator,
  proposalPublicAcceptanceValidator,
  proposalPublicEventValidator,
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

router.post(
  "/shared/:token/accept",
  proposalPublicAcceptanceValidator,
  validate,
  proposalsController.acceptSharedProposal,
);

router.post(
  "/shared/:token/events",
  proposalPublicEventValidator,
  validate,
  proposalsController.recordSharedProposalEvent,
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

router.post(
  "/discovery-sessions/start",
  authorizePermission("proposals:write"),
  startProposalDiscoverySessionValidator,
  validate,
  proposalDiscoveryController.startOrResumeSession,
);

router.get(
  "/discovery-sessions/:sessionId",
  authorizePermission("proposals:read"),
  proposalDiscoverySessionIdParamValidator,
  validate,
  proposalDiscoveryController.getSession,
);

router.patch(
  "/discovery-sessions/:sessionId",
  authorizePermission("proposals:write"),
  updateProposalDiscoverySessionValidator,
  validate,
  proposalDiscoveryController.updateSession,
);

router.post(
  "/discovery-sessions/:sessionId/generate-draft",
  authorizePermission("proposals:write"),
  proposalDiscoverySessionIdParamValidator,
  validate,
  proposalDiscoveryController.generateDraftProposal,
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
