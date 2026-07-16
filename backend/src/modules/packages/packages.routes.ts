import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizeAnyPermission, authorizePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { packagesController } from "./packages.controller.js";
import {
  createPackageValidator,
  listPackagesValidator,
  packageIdParamValidator,
  updatePackageValidator,
} from "./packages.validators.js";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  authorizeAnyPermission("contacts:read", "client_accounts:read", "settings:read"),
  listPackagesValidator,
  validate,
  packagesController.listPackages,
);

router.post(
  "/",
  authorizePermission("settings:write"),
  createPackageValidator,
  validate,
  packagesController.createPackage,
);

router.patch(
  "/:id",
  authorizePermission("settings:write"),
  updatePackageValidator,
  validate,
  packagesController.updatePackage,
);

router.delete(
  "/:id",
  authorizePermission("settings:write"),
  packageIdParamValidator,
  validate,
  packagesController.deletePackage,
);

export default router;
