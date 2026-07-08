import { Router } from "express";
import { treatmentsController } from "./treatments.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizeAnyPermission, authorizePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { createTreatmentValidator, treatmentIdParamValidator, updateTreatmentValidator } from "./treatments.validators.js";

const router = Router();

router.use(authenticate);

// @route   GET /api/treatments
// @desc    List treatment catalogue items for the clinic
// @access  Private
router.get(
  "/",
  authorizeAnyPermission("settings:read", "appointments:read"),
  treatmentsController.listTreatments,
);

// @route   POST /api/treatments
// @desc    Create a new treatment catalogue item
// @access  Private
router.post(
  "/",
  authorizePermission("settings:write"),
  createTreatmentValidator,
  validate,
  treatmentsController.createTreatment,
);

// @route   PATCH /api/treatments/:id
// @desc    Update a treatment catalogue item
// @access  Private
router.patch(
  "/:id",
  authorizePermission("settings:write"),
  updateTreatmentValidator,
  validate,
  treatmentsController.updateTreatment,
);

// @route   DELETE /api/treatments/:id
// @desc    Soft delete a treatment catalogue item
// @access  Private
router.delete(
  "/:id",
  authorizePermission("settings:write"),
  treatmentIdParamValidator,
  validate,
  treatmentsController.deleteTreatment,
);

export default router;
