import { Router } from "express";
import { body, param, query } from "express-validator";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { clinicOsEntitlementsController } from "./clinic-os-entitlements.controller.js";

const router = Router();

const accessTiers = ["free_audit", "paid_diagnostic", "clinic_os"];

router.use(authenticate);

router.post(
  "/publish",
  authorizePermission("settings:write"),
  body("clinicId").optional().isUUID(),
  body("tenantKey").isString().trim().notEmpty().isLength({ max: 160 }),
  body("accessTier").isIn(accessTiers),
  body("growthScoreRequested").optional().isBoolean(),
  body("paidDiagnosticConfirmed").optional().isBoolean(),
  body("sufficientDataConfirmed").optional().isBoolean(),
  body("settings").optional().isObject(),
  validate,
  clinicOsEntitlementsController.publishSettings,
);

router.post(
  "/rollback",
  authorizePermission("settings:write"),
  body("clinicId").optional().isUUID(),
  body("tenantKey").isString().trim().notEmpty().isLength({ max: 160 }),
  body("version").isInt({ min: 1 }),
  validate,
  clinicOsEntitlementsController.rollback,
);

router.get(
  "/pushes/pending",
  authorizePermission("settings:read"),
  query("limit").optional().isInt({ min: 1, max: 200 }),
  validate,
  clinicOsEntitlementsController.listPendingPushes,
);

router.post(
  "/pushes/:pushId/sent",
  authorizePermission("settings:write"),
  param("pushId").isUUID(),
  body("clinicId").isUUID(),
  validate,
  clinicOsEntitlementsController.markPushSent,
);

router.post(
  "/pushes/:pushId/failed",
  authorizePermission("settings:write"),
  param("pushId").isUUID(),
  body("clinicId").isUUID(),
  body("errorMessage").optional().isString().trim().isLength({ max: 1000 }),
  validate,
  clinicOsEntitlementsController.markPushFailed,
);

router.post(
  "/pushes/:pushId/deliver",
  authorizePermission("settings:write"),
  param("pushId").isUUID(),
  body("clinicId").isUUID(),
  validate,
  clinicOsEntitlementsController.deliverPush,
);

router.post(
  "/pushes/:pushId/acknowledge",
  authorizePermission("settings:write"),
  param("pushId").isUUID(),
  body("clinicId").isUUID(),
  body("payloadHash").isLength({ min: 64, max: 64 }).isHexadecimal(),
  validate,
  clinicOsEntitlementsController.acknowledgePush,
);

export default router;
