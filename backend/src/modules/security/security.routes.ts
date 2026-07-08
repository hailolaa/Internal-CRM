import { Router } from "express";
import { securityController } from "./security.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { body } from "express-validator";
import { validate } from "../../middleware/validate.js";
import { sensitiveAuthRateLimit } from "../../middleware/rateLimit.js";

const router = Router();

// All security routes require authentication
router.use(authenticate);

// @route   POST /api/security/2fa/setup
// @desc    Generate TOTP secret and QR code
// @access  Private
router.post("/2fa/setup", securityController.setup2FA);

// @route   POST /api/security/2fa/enable
// @desc    Verify token and enable 2FA
// @access  Private
router.post(
  "/2fa/enable",
  [body("token").trim().notEmpty().withMessage("2FA token is required")],
  validate,
  securityController.enable2FA
);

// @route   POST /api/security/2fa/disable
// @desc    Disable 2FA (requires password)
// @access  Private
router.post(
  "/2fa/disable",
  sensitiveAuthRateLimit,
  [body("password").notEmpty().withMessage("Password is required")],
  validate,
  securityController.disable2FA
);

// @route   POST /api/security/password/change
// @desc    Change password (while logged in)
// @access  Private
router.post(
  "/password/change",
  sensitiveAuthRateLimit,
  [
    body("currentPassword").notEmpty().withMessage("Current password is required"),
    body("newPassword")
      .isLength({ min: 8 })
      .withMessage("New password must be at least 8 characters"),
  ],
  validate,
  securityController.changePassword
);

export default router;
