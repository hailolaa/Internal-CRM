import { Router } from "express";
import { complianceController } from "./compliance.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import {
  complianceDocumentIdParamValidator,
  complianceDocumentFileValidator,
  createDataAccessRequestValidator,
  createComplianceDocumentValidator,
  dataAccessRequestIdParamValidator,
  updateDataAccessRequestValidator,
  updateComplianceDocumentValidator,
  updateComplianceSettingsValidator,
} from "./compliance.validators.js";

const router = Router();

router.use(authenticate);

// @route   GET /api/compliance/documents
// @desc    List compliance documents
// @access  Private
router.get("/documents", authorizePermission("settings:read"), complianceController.listDocuments);

// @route   POST /api/compliance/documents
// @desc    Create a compliance document
// @access  Private
router.post("/documents", authorizePermission("settings:write"), createComplianceDocumentValidator, validate, complianceController.createDocument);

// @route   POST /api/compliance/documents/:id/file
// @desc    Upload/replace secure compliance document file
// @access  Private
router.post("/documents/:id/file", authorizePermission("settings:write"), complianceDocumentFileValidator, validate, complianceController.uploadDocumentFile);

// @route   GET /api/compliance/documents/:id/file
// @desc    Preview/download secure compliance document file
// @access  Private
router.get("/documents/:id/file", authorizePermission("settings:read"), complianceDocumentIdParamValidator, validate, complianceController.getDocumentFile);

// @route   DELETE /api/compliance/documents/:id/file
// @desc    Delete secure compliance document file
// @access  Private
router.delete("/documents/:id/file", authorizePermission("settings:write"), complianceDocumentIdParamValidator, validate, complianceController.deleteDocumentFile);

// @route   PATCH /api/compliance/documents/:id
// @desc    Update a compliance document
// @access  Private
router.patch("/documents/:id", authorizePermission("settings:write"), updateComplianceDocumentValidator, validate, complianceController.updateDocument);

// @route   DELETE /api/compliance/documents/:id
// @desc    Soft delete a compliance document
// @access  Private
router.delete("/documents/:id", authorizePermission("settings:write"), complianceDocumentIdParamValidator, validate, complianceController.deleteDocument);

// @route   GET /api/compliance/settings
// @desc    Read data protection settings
// @access  Private
router.get("/settings", authorizePermission("settings:read"), complianceController.getSettings);

// @route   PUT /api/compliance/settings
// @desc    Update data protection settings
// @access  Private
router.put("/settings", authorizePermission("settings:write"), updateComplianceSettingsValidator, validate, complianceController.updateSettings);

// @route   GET /api/compliance/data-access-requests
// @desc    List data access requests
// @access  Private
router.get("/data-access-requests", authorizePermission("settings:read"), complianceController.listDataAccessRequests);

// @route   POST /api/compliance/data-access-requests
// @desc    Create data access request
// @access  Private
router.post("/data-access-requests", authorizePermission("settings:write"), createDataAccessRequestValidator, validate, complianceController.createDataAccessRequest);

// @route   PATCH /api/compliance/data-access-requests/:id
// @desc    Update data access request lifecycle
// @access  Private
router.patch("/data-access-requests/:id", authorizePermission("settings:write"), updateDataAccessRequestValidator, validate, complianceController.updateDataAccessRequest);

// @route   DELETE /api/compliance/data-access-requests/:id
// @desc    Archive data access request
// @access  Private
router.delete("/data-access-requests/:id", authorizePermission("settings:write"), dataAccessRequestIdParamValidator, validate, complianceController.archiveDataAccessRequest);

export default router;
