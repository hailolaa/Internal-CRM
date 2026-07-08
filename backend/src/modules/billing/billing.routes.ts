import { Router } from "express";
import { billingController } from "./billing.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { body, param } from "express-validator";
import { validate } from "../../middleware/validate.js";

const router = Router();


// @route   POST /api/billing/webhook
// @desc    Public webhook for Stripe events
// @access  Public (Signature verified in controller)
router.post("/webhook", billingController.handleWebhook);

// @route   GET /api/billing/status
// @desc    Get current subscription and usage status
// @access  Private
router.get("/status", authenticate, authorizePermission("billing:read"), billingController.getStatus);

// @route   POST /api/billing/checkout
// @desc    Create a Stripe checkout session
// @access  Private (Super Admin Only)
router.post(
  "/checkout",
  authenticate,
  authorize("SUPER_ADMIN"),
  [
    body("planType").isIn(["starter", "professional"]).withMessage("Invalid plan type"),
    body("mode").optional({ nullable: true }).isIn(["hosted", "embedded"]).withMessage("Invalid checkout mode"),
    body("successUrl").optional({ nullable: true }).isURL({ require_protocol: true }),
    body("cancelUrl").optional({ nullable: true }).isURL({ require_protocol: true }),
    body("returnUrl").optional({ nullable: true }).isURL({ require_protocol: true }),
    body("trialDays").optional({ nullable: true }).isInt({ min: 1, max: 30 }).toInt(),
  ],
  validate,
  billingController.createSession,
);

// @route   GET /api/billing/checkout/:sessionId/status
// @desc    Confirm a Stripe checkout session and sync subscription state
// @access  Private (Super Admin Only)
router.get(
  "/checkout/:sessionId/status",
  authenticate,
  authorize("SUPER_ADMIN"),
  [param("sessionId").isString().trim().isLength({ min: 8 })],
  validate,
  billingController.getCheckoutSessionStatus,
);

// @route   POST /api/billing/cancel
// @desc    Cancel a subscription
// @access  Private (Super Admin Only)
router.post("/cancel", authenticate, authorize("SUPER_ADMIN"), billingController.cancelSubscription);

export default router;
