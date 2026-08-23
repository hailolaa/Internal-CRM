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
  createProposalScopeLibraryItemValidator,
  compareProposalTemplateVersionValidator,
  createProposalTemplateValidator,
  createProposalTemplateVersionValidator,
  createProposalValidator,
  createProposalSignatureRequestValidator,
  exportProposalsValidator,
  listProposalsValidator,
  proposalTemplateIdParamValidator,
  proposalTemplateVersionIdParamValidator,
  proposalIdParamValidator,
  proposalPublicAcceptanceValidator,
  proposalPublicEventValidator,
  proposalPublicTokenParamValidator,
  proposalScopeLibraryItemIdParamValidator,
  rejectProposalTemplateVersionValidator,
  rollbackProposalTemplateValidator,
  listProposalScopeLibraryValidator,
  proposalStatusUpdateValidator,
  proposalSourceDataValidator,
  sendProposalValidator,
  updateProposalScopeLibraryItemValidator,
  updateProposalTemplateVersionValidator,
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

router.post(
  "/templates",
  authorizeAnyPermission("proposal_templates:write", "proposals:write"),
  createProposalTemplateValidator,
  validate,
  proposalsController.createProposalTemplate,
);

router.get(
  "/templates/:templateId/versions",
  authorizePermission("proposals:read"),
  proposalTemplateIdParamValidator,
  validate,
  proposalsController.listProposalTemplateVersions,
);

router.post(
  "/templates/:templateId/versions",
  authorizeAnyPermission("proposal_templates:write", "proposals:write"),
  createProposalTemplateVersionValidator,
  validate,
  proposalsController.createProposalTemplateVersion,
);

router.get(
  "/templates/:templateId/versions/compare",
  authorizePermission("proposals:read"),
  compareProposalTemplateVersionValidator,
  validate,
  proposalsController.compareProposalTemplateVersions,
);

router.patch(
  "/templates/:templateId/versions/:versionId",
  authorizeAnyPermission("proposal_templates:write", "proposals:write"),
  updateProposalTemplateVersionValidator,
  validate,
  proposalsController.updateProposalTemplateVersion,
);

router.post(
  "/templates/:templateId/versions/:versionId/submit",
  authorizeAnyPermission("proposal_templates:write", "proposals:write"),
  proposalTemplateVersionIdParamValidator,
  validate,
  proposalsController.submitProposalTemplateVersion,
);

router.post(
  "/templates/:templateId/versions/:versionId/approve",
  authorizePermission("proposal_templates:approve"),
  proposalTemplateVersionIdParamValidator,
  validate,
  proposalsController.approveProposalTemplateVersion,
);

router.post(
  "/templates/:templateId/versions/:versionId/reject",
  authorizePermission("proposal_templates:approve"),
  rejectProposalTemplateVersionValidator,
  validate,
  proposalsController.rejectProposalTemplateVersion,
);

router.post(
  "/templates/:templateId/versions/:versionId/publish",
  authorizePermission("proposal_templates:approve"),
  proposalTemplateVersionIdParamValidator,
  validate,
  proposalsController.publishProposalTemplateVersion,
);

router.post(
  "/templates/:templateId/rollback",
  authorizePermission("proposal_templates:approve"),
  rollbackProposalTemplateValidator,
  validate,
  proposalsController.rollbackProposalTemplate,
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
  "/scope-library",
  authorizePermission("proposals:read"),
  listProposalScopeLibraryValidator,
  validate,
  proposalsController.listScopeLibraryItems,
);

router.post(
  "/scope-library",
  authorizePermission("proposals:write"),
  createProposalScopeLibraryItemValidator,
  validate,
  proposalsController.createScopeLibraryItem,
);

router.patch(
  "/scope-library/:scopeItemId",
  authorizePermission("proposals:write"),
  updateProposalScopeLibraryItemValidator,
  validate,
  proposalsController.updateScopeLibraryItem,
);

router.post(
  "/scope-library/:scopeItemId/archive",
  authorizePermission("proposals:write"),
  proposalScopeLibraryItemIdParamValidator,
  validate,
  proposalsController.archiveScopeLibraryItem,
);

router.post(
  "/scope-library/:scopeItemId/restore",
  authorizePermission("proposals:write"),
  proposalScopeLibraryItemIdParamValidator,
  validate,
  proposalsController.restoreScopeLibraryItem,
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
  "/:id/validate",
  authorizePermission("proposals:read"),
  proposalIdParamValidator,
  validate,
  proposalsController.validateProposal,
);

router.post(
  "/:id/approve",
  authorizePermission("proposals:write"),
  proposalIdParamValidator,
  validate,
  proposalsController.approveProposal,
);

router.post(
  "/:id/version-lock",
  authorizePermission("proposals:write"),
  sendProposalValidator,
  validate,
  proposalsController.lockProposalVersion,
);

router.get(
  "/:id/render",
  authorizePermission("proposals:read"),
  proposalIdParamValidator,
  validate,
  proposalsController.renderProposal,
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
