import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { depositsController } from "./deposits.controller.js";
import { createDepositValidator, updateDepositValidator } from "./deposits.validators.js";
import { createDepositPaymentSessionValidator } from "./deposits.validators.js";

const router = Router();

router.use(authenticate);

// @route   GET /api/deposits
// @desc    List deposit tracking records
// @access  Private
router.get("/", authorizePermission("reports:read"), depositsController.listDeposits);

// @route   POST /api/deposits
// @desc    Create deposit tracking record
// @access  Private
router.post("/", authorizePermission("reports:write"), createDepositValidator, validate, depositsController.createDeposit);

// Create Stripe payment session for a deposit
router.post("/session", authorizePermission("reports:write"), createDepositPaymentSessionValidator, validate, depositsController.createPaymentSession);

// @route   PATCH /api/deposits/:id
// @desc    Update deposit tracking record
// @access  Private
router.patch("/:id", authorizePermission("reports:write"), updateDepositValidator, validate, depositsController.updateDeposit);

export default router;

