import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { clientOperatingRegisterController } from "./client-operating-register.controller.js";
import { importClientOperatingRegisterValidator } from "./client-operating-register.validators.js";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  authorizePermission("client_accounts:read"),
  clientOperatingRegisterController.listRecords,
);

router.post(
  "/import",
  authorizePermission("client_accounts:write"),
  importClientOperatingRegisterValidator,
  validate,
  clientOperatingRegisterController.importRecords,
);

export default router;
