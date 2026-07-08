import { Router } from "express";
import { campaignsController } from "./campaigns.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import {
  campaignMediaIdValidator,
  campaignMediaReplaceValidator,
  campaignMediaUploadValidator,
  createCampaignValidator,
  updateCampaignStatusValidator,
} from "./campaigns.validators.js";

const router = Router();

router.use(authenticate);

// @route   GET /api/campaigns
// @desc    List clinic campaigns
// @access  Private
router.get("/", authorizePermission("marketing:read"), campaignsController.listCampaigns);

// @route   POST /api/campaigns
// @desc    Create clinic campaign
// @access  Private
router.post("/", authorizePermission("marketing:write"), createCampaignValidator, validate, campaignsController.createCampaign);

// @route   GET /api/campaigns/:id/media
// @desc    List campaign media
// @access  Private
router.get("/:id/media", authorizePermission("marketing:read"), campaignMediaIdValidator.slice(0, 1), validate, campaignsController.listCampaignMedia);

// @route   POST /api/campaigns/:id/media
// @desc    Upload campaign media
// @access  Private
router.post("/:id/media", authorizePermission("marketing:write"), campaignMediaUploadValidator, validate, campaignsController.uploadCampaignMedia);

// @route   PATCH /api/campaigns/:id/media/:mediaId
// @desc    Replace campaign media
// @access  Private
router.patch("/:id/media/:mediaId", authorizePermission("marketing:write"), campaignMediaReplaceValidator, validate, campaignsController.replaceCampaignMedia);

// @route   DELETE /api/campaigns/:id/media/:mediaId
// @desc    Delete campaign media
// @access  Private
router.delete("/:id/media/:mediaId", authorizePermission("marketing:write"), campaignMediaIdValidator, validate, campaignsController.deleteCampaignMedia);

// @route   PATCH /api/campaigns/:id/status
// @desc    Update campaign status
// @access  Private
router.patch("/:id/status", authorizePermission("marketing:write"), updateCampaignStatusValidator, validate, campaignsController.updateCampaignStatus);

export default router;
