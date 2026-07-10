import { Router } from "express";
import { rolesController } from "./roles.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { createRoleValidator, roleIdValidator, updateRoleValidator } from "./roles.validators.js";

const router = Router();

router.use(authenticate);

// @route   GET /api/roles
// @desc    List roles available to the workspace
// @access  Private
router.get("/", authorizePermission("settings:read"), rolesController.listRoles);

// @route   GET /api/roles/permissions
// @desc    List assignable permissions
// @access  Private
router.get("/permissions", authorizePermission("settings:read"), rolesController.listPermissions);

// @route   POST /api/roles
// @desc    Create a workspace role
// @access  Private
router.post("/", authorizePermission("settings:write"), createRoleValidator, validate, rolesController.createRole);

// @route   PATCH /api/roles/:id
// @desc    Update a workspace role
// @access  Private
router.patch("/:id", authorizePermission("settings:write"), updateRoleValidator, validate, rolesController.updateRole);

// @route   DELETE /api/roles/:id
// @desc    Archive a workspace role
// @access  Private
router.delete("/:id", authorizePermission("settings:write"), roleIdValidator, validate, rolesController.archiveRole);

export default router;
