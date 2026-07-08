import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { contactsController } from "./contacts.controller.js";
import {
  contactIdParamValidator,
  createContactValidator,
  importContactsPreviewValidator,
  importContactsValidator,
  leadBookingActionValidator,
  leadCallOutcomeActionValidator,
  leadDepositActionValidator,
  leadMessageTemplateActionValidator,
  leadTaskActionValidator,
  listContactsValidator,
  resolveDuplicateValidator,
  updateContactValidator,
} from "./contacts.validators.js";
import { importBatchIdParamValidator } from "./contacts.validators.js";

const router = Router();

router.use(authenticate);

// @route   GET /api/contacts
// @desc    List clinic contacts with search, filters, sorting, and pagination
// @access  Private
router.get(
  "/",
  authorizePermission("contacts:read"),
  listContactsValidator,
  validate,
  contactsController.listContacts,
);

// @route   POST /api/contacts
// @desc    Create a contact and flag likely duplicates
// @access  Private
router.post(
  "/",
  authorizePermission("contacts:write"),
  createContactValidator,
  validate,
  contactsController.createContact,
);

// @route   POST /api/contacts/import/preview
// @desc    Preview contacts from a published Google Sheets URL
// @access  Private
router.post(
  "/import/preview",
  authorizePermission("contacts:write"),
  importContactsPreviewValidator,
  validate,
  contactsController.previewImportContacts,
);

// @route   POST /api/contacts/import
// @desc    Import spreadsheet contacts
// @access  Private
router.post(
  "/import",
  authorizePermission("contacts:write"),
  importContactsValidator,
  validate,
  contactsController.importContacts,
);

// @route   GET /api/contacts/imports
// @desc    List recent contact import batches
// @access  Private
router.get(
  "/imports",
  authorizePermission("contacts:read"),
  contactsController.listImportBatches,
);

// GET /api/contacts/imports/:id - import batch details
router.get(
  "/imports/:id",
  authorizePermission("contacts:read"),
  importBatchIdParamValidator,
  validate,
  // validator will be added
  contactsController.getImportBatch,
);

// @route   GET /api/contacts/duplicates
// @desc    List open duplicate candidates
// @access  Private
router.get(
  "/duplicates",
  authorizePermission("contacts:read"),
  contactsController.listDuplicateCandidates,
);

// @route   GET /api/contacts/export/csv
// @desc    Export clinic contacts with the same filters as the lead inbox
// @access  Private
router.get(
  "/export/csv",
  authorizePermission("contacts:read"),
  listContactsValidator,
  validate,
  contactsController.exportContactsCsv,
);

// @route   PATCH /api/contacts/duplicates/:candidateId
// @desc    Resolve a duplicate candidate
// @access  Private
router.patch(
  "/duplicates/:candidateId",
  authorizePermission("contacts:write"),
  resolveDuplicateValidator,
  validate,
  contactsController.resolveDuplicateCandidate,
);

// @route   GET /api/contacts/:id/timeline
// @desc    Read contact timeline activity
// @access  Private
router.get(
  "/:id/timeline",
  authorizePermission("contacts:read"),
  contactIdParamValidator,
  validate,
  contactsController.getContactTimeline,
);

// @route   GET /api/contacts/:id/activity
// @desc    Read grouped lead activity for the detail drawer
// @access  Private
router.get(
  "/:id/activity",
  authorizePermission("contacts:read"),
  contactIdParamValidator,
  validate,
  contactsController.getContactLinkedActivity,
);

// @route   GET /api/contacts/:id/actions
// @desc    Read permission-aware lead drawer action metadata
// @access  Private
router.get(
  "/:id/actions",
  authorizePermission("contacts:read"),
  contactIdParamValidator,
  validate,
  contactsController.getLeadDrawerActions,
);

// @route   POST /api/contacts/:id/actions/call-outcome
// @desc    Log/update a linked call outcome from the lead drawer
// @access  Private(calls write)
router.post(
  "/:id/actions/call-outcome",
  authorizePermission("calls:write"),
  leadCallOutcomeActionValidator,
  validate,
  contactsController.logLeadCallOutcome,
);

// @route   POST /api/contacts/:id/actions/message-template
// @desc    Queue or send a rendered message template from the lead drawer
// @access  Private(marketing read + contact read)
router.post(
  "/:id/actions/message-template",
  authorizePermission("marketing:read"),
  leadMessageTemplateActionValidator,
  validate,
  contactsController.sendLeadMessageTemplate,
);

// @route   POST /api/contacts/:id/actions/booking
// @desc    Create a consult booking from the lead drawer
// @access  Private(appointments write)
router.post(
  "/:id/actions/booking",
  authorizePermission("appointments:write"),
  leadBookingActionValidator,
  validate,
  contactsController.createLeadBooking,
);

// @route   POST /api/contacts/:id/actions/deposit
// @desc    Create or update a deposit/payment status from the lead drawer
// @access  Private(reports write)
router.post(
  "/:id/actions/deposit",
  authorizePermission("reports:write"),
  leadDepositActionValidator,
  validate,
  contactsController.recordLeadDeposit,
);

// @route   POST /api/contacts/:id/actions/task
// @desc    Create a follow-up task from the lead drawer
// @access  Private(events write)
router.post(
  "/:id/actions/task",
  authorizePermission("events:write"),
  leadTaskActionValidator,
  validate,
  contactsController.createLeadTask,
);

// @route   PATCH /api/contacts/:id/mark-contacted
// @desc    Record the first response time for a lead
// @access  Private
router.patch(
  "/:id/mark-contacted",
  authorizePermission("contacts:write"),
  contactIdParamValidator,
  validate,
  contactsController.markContacted,
);

// @route   GET /api/contacts/:id
// @desc    Read one clinic contact
// @access  Private
router.get(
  "/:id",
  authorizePermission("contacts:read"),
  contactIdParamValidator,
  validate,
  contactsController.getContact,
);

// @route   PATCH /api/contacts/:id
// @desc    Update one clinic contact
// @access  Private
router.patch(
  "/:id",
  authorizePermission("contacts:write"),
  updateContactValidator,
  validate,
  contactsController.updateContact,
);

// @route   DELETE /api/contacts/:id
// @desc    Soft delete one clinic contact
// @access  Private
router.delete(
  "/:id",
  authorizePermission("contacts:delete"),
  contactIdParamValidator,
  validate,
  contactsController.deleteContact,
);

export default router;
