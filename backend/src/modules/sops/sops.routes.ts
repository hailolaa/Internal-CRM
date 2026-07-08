import { Router } from "express";
import { sopsController } from "./sops.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import {
  createSopValidator,
  listSopsValidator,
  sopIdParamValidator,
  updateSopValidator,
} from "./sops.validators.js";

const router = Router();

router.use(authenticate);

// @route   GET /api/sops
// @desc    List clinic SOPs
// @access  Private
router.get(
  "/",
  authorizePermission("sops:read"),
  listSopsValidator,
  validate,
  sopsController.listSops,
);

// @route   POST /api/sops
// @desc    Create a clinic SOP
// @access  Private
router.post(
  "/",
  authorizePermission("sops:write"),
  createSopValidator,
  validate,
  sopsController.createSop,
);

// @route   PATCH /api/sops/:id
// @desc    Update a clinic SOP
// @access  Private
router.patch(
  "/:id",
  authorizePermission("sops:write"),
  updateSopValidator,
  validate,
  sopsController.updateSop,
);

// @route   DELETE /api/sops/:id
// @desc    Soft delete a clinic SOP
// @access  Private
router.delete(
  "/:id",
  authorizePermission("sops:write"),
  sopIdParamValidator,
  validate,
  sopsController.deleteSop,
);

export default router;
