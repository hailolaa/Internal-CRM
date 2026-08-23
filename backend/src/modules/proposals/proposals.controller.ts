import { Request, Response, NextFunction } from "express";
import { userCanManageAllClientAccounts } from "../../middleware/authorize.js";
import { proposalsService } from "./proposals.service.js";
import { proposalSignaturesService } from "./proposal-signatures.service.js";

export class ProposalsController {
  getSharedProposal = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const preview = await proposalsService.getSharedProposal(String(req.params.token || ""));
      res.setHeader("Cache-Control", "no-store");
      res.status(200).json({ status: "success", data: preview });
    } catch (error) {
      next(error);
    }
  };

  acceptSharedProposal = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const preview = await proposalsService.acceptSharedProposal(
        String(req.params.token || ""),
        req.body,
        {
          ipAddress: req.ip || null,
          userAgent: req.get("user-agent") || null,
        },
      );
      res.setHeader("Cache-Control", "no-store");
      res.status(200).json({ status: "success", data: preview });
    } catch (error) {
      next(error);
    }
  };

  recordSharedProposalEvent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await proposalsService.recordSharedProposalEvent(
        String(req.params.token || ""),
        req.body,
        {
          ipAddress: req.ip || null,
          userAgent: req.get("user-agent") || null,
        },
      );
      res.setHeader("Cache-Control", "no-store");
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  };

  listProposals = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const proposals = await proposalsService.listProposals(clinicId, req.query as any);
      res.status(200).json({ status: "success", data: proposals });
    } catch (error) {
      next(error);
    }
  };

  listProofAssets = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const includeInactive = req.query.includeInactive === "true";
      const assets = await proposalsService.listProofAssets(clinicId, includeInactive);
      res.status(200).json({ status: "success", data: assets });
    } catch (error) {
      next(error);
    }
  };

  createProofAsset = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const asset = await proposalsService.createProofAsset(clinicId, userId, req.body);
      res.status(201).json({ status: "success", data: asset });
    } catch (error) {
      next(error);
    }
  };

  listScopeLibraryItems = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const result = await proposalsService.listScopeLibraryItems(clinicId, req.query as any);
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  };

  createScopeLibraryItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const item = await proposalsService.createScopeLibraryItem(clinicId, userId, req.body);
      res.status(201).json({ status: "success", data: item });
    } catch (error) {
      next(error);
    }
  };

  updateScopeLibraryItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const item = await proposalsService.updateScopeLibraryItem(clinicId, userId, String(req.params.scopeItemId), req.body);
      res.status(200).json({ status: "success", data: item });
    } catch (error) {
      next(error);
    }
  };

  archiveScopeLibraryItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const item = await proposalsService.setScopeLibraryItemArchived(clinicId, userId, String(req.params.scopeItemId), true);
      res.status(200).json({ status: "success", data: item });
    } catch (error) {
      next(error);
    }
  };

  restoreScopeLibraryItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const item = await proposalsService.setScopeLibraryItemArchived(clinicId, userId, String(req.params.scopeItemId), false);
      res.status(200).json({ status: "success", data: item });
    } catch (error) {
      next(error);
    }
  };

  listProposalTemplates = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const includeInactive = req.query.includeInactive === "true";
      const templates = await proposalsService.listProposalTemplates(clinicId, includeInactive);
      res.status(200).json({ status: "success", data: templates });
    } catch (error) {
      next(error);
    }
  };

  createProposalTemplate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const template = await proposalsService.createProposalTemplate(clinicId, userId, req.body);
      res.status(201).json({ status: "success", data: template });
    } catch (error) {
      next(error);
    }
  };

  listProposalTemplateVersions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const versions = await proposalsService.listTemplateVersions(clinicId, String(req.params.templateId));
      res.status(200).json({ status: "success", data: versions });
    } catch (error) {
      next(error);
    }
  };

  createProposalTemplateVersion = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const version = await proposalsService.createTemplateDraftVersion(clinicId, userId, String(req.params.templateId), req.body);
      res.status(201).json({ status: "success", data: version });
    } catch (error) {
      next(error);
    }
  };

  updateProposalTemplateVersion = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const version = await proposalsService.updateTemplateDraftVersion(
        clinicId,
        userId,
        String(req.params.templateId),
        String(req.params.versionId),
        req.body,
      );
      res.status(200).json({ status: "success", data: version });
    } catch (error) {
      next(error);
    }
  };

  submitProposalTemplateVersion = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const version = await proposalsService.submitTemplateVersion(clinicId, userId, String(req.params.templateId), String(req.params.versionId));
      res.status(200).json({ status: "success", data: version });
    } catch (error) {
      next(error);
    }
  };

  approveProposalTemplateVersion = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const version = await proposalsService.approveTemplateVersion(clinicId, userId, String(req.params.templateId), String(req.params.versionId));
      res.status(200).json({ status: "success", data: version });
    } catch (error) {
      next(error);
    }
  };

  rejectProposalTemplateVersion = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const version = await proposalsService.rejectTemplateVersion(clinicId, userId, String(req.params.templateId), String(req.params.versionId), req.body);
      res.status(200).json({ status: "success", data: version });
    } catch (error) {
      next(error);
    }
  };

  publishProposalTemplateVersion = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const version = await proposalsService.publishTemplateVersion(clinicId, userId, String(req.params.templateId), String(req.params.versionId));
      res.status(200).json({ status: "success", data: version });
    } catch (error) {
      next(error);
    }
  };

  rollbackProposalTemplate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const version = await proposalsService.rollbackTemplateVersion(clinicId, userId, String(req.params.templateId), req.body);
      res.status(201).json({ status: "success", data: version });
    } catch (error) {
      next(error);
    }
  };

  compareProposalTemplateVersions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const comparison = await proposalsService.compareTemplateVersions(
        clinicId,
        String(req.params.templateId),
        String(req.query.fromVersionId),
        String(req.query.toVersionId),
      );
      res.status(200).json({ status: "success", data: comparison });
    } catch (error) {
      next(error);
    }
  };

  exportProposalsCsv = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const csv = await proposalsService.exportProposalsCsv(clinicId, req.query as any);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="proposals-export.csv"');
      res.status(200).send(csv);
    } catch (error) {
      next(error);
    }
  };

  getProposal = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const proposal = await proposalsService.getProposal(clinicId, String(req.params.id));
      res.status(200).json({ status: "success", data: proposal });
    } catch (error) {
      next(error);
    }
  };

  getProposalSourceData = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const access = { canManageAllClientAccounts: await userCanManageAllClientAccounts(userId, clinicId) };
      const sourceData = await proposalsService.getProposalSourceData(clinicId, req.query as any, access);
      res.status(200).json({ status: "success", data: sourceData });
    } catch (error) {
      next(error);
    }
  };

  createProposal = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const access = { canManageAllClientAccounts: await userCanManageAllClientAccounts(userId, clinicId) };
      const proposal = await proposalsService.createProposal(clinicId, userId, req.body, access);
      res.status(201).json({ status: "success", data: proposal });
    } catch (error) {
      next(error);
    }
  };

  createProposalShare = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const share = await proposalsService.createProposalShare(clinicId, userId, String(req.params.id));
      res.status(201).json({ status: "success", data: share });
    } catch (error) {
      next(error);
    }
  };

  validateProposal = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const validation = await proposalsService.validateProposalForClientUse(clinicId, String(req.params.id));
      res.status(200).json({ status: "success", data: validation });
    } catch (error) {
      next(error);
    }
  };

  approveProposal = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const access = { canManageAllClientAccounts: await userCanManageAllClientAccounts(userId, clinicId) };
      const proposal = await proposalsService.approveProposalForClientUse(clinicId, userId, String(req.params.id), access);
      res.status(200).json({ status: "success", data: proposal });
    } catch (error) {
      next(error);
    }
  };

  lockProposalVersion = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const proposal = await proposalsService.lockProposalVersion(clinicId, userId, String(req.params.id), req.body);
      res.status(200).json({ status: "success", data: proposal });
    } catch (error) {
      next(error);
    }
  };

  renderProposal = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const renderData = await proposalsService.renderProposal(clinicId, String(req.params.id));
      res.status(200).json({ status: "success", data: renderData });
    } catch (error) {
      next(error);
    }
  };

  markProposalSent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const proposal = await proposalsService.markProposalSent(clinicId, userId, String(req.params.id), req.body);
      res.status(200).json({ status: "success", data: proposal });
    } catch (error) {
      next(error);
    }
  };

  updateProposalStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const access = { canManageAllClientAccounts: await userCanManageAllClientAccounts(userId, clinicId) };
      const proposal = await proposalsService.updateProposalStatus(clinicId, userId, String(req.params.id), req.body, access);
      res.status(200).json({ status: "success", data: proposal });
    } catch (error) {
      next(error);
    }
  };

  updateProposal = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const access = { canManageAllClientAccounts: await userCanManageAllClientAccounts(userId, clinicId) };
      const proposal = await proposalsService.updateProposal(clinicId, userId, String(req.params.id), req.body, access);
      res.status(200).json({ status: "success", data: proposal });
    } catch (error) {
      next(error);
    }
  };

  archiveProposal = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await proposalsService.archiveProposal(clinicId, userId, String(req.params.id));
      res.status(200).json({ status: "success", message: "Proposal archived successfully" });
    } catch (error) {
      next(error);
    }
  };

  listSignatureRequests = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const signatures = await proposalSignaturesService.listSignatureRequests(clinicId, String(req.params.id));
      res.status(200).json({ status: "success", data: signatures });
    } catch (error) {
      next(error);
    }
  };

  createSignatureRequest = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const signature = await proposalSignaturesService.createSignatureRequest(
        clinicId,
        userId,
        String(req.params.id),
        req.body,
      );
      res.status(201).json({ status: "success", data: signature });
    } catch (error) {
      next(error);
    }
  };

  handleSignatureWebhook = async (req: Request, res: Response, next: NextFunction) => {
    try {
      proposalSignaturesService.verifyWebhookSignature(
        (req as any).rawBody,
        req.get("x-esign-signature-256"),
      );
      const result = await proposalSignaturesService.handleProviderWebhook(
        String(req.params.provider),
        req.body,
        (req as any).rawBody,
      );
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  };
}

export const proposalsController = new ProposalsController();
