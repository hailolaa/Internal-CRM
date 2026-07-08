import { Router } from "express";
import { reviewsController } from "./reviews.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { reviewIdParamValidator, updateReviewStatusValidator } from "./reviews.validators.js";

const router = Router();

router.use(authenticate);

router.get("/summary", authorizePermission("marketing:read"), reviewsController.getSummary);

router.get("/settings", authorizePermission("marketing:read"), reviewsController.getSettings);

router.patch("/settings", authorizePermission("marketing:write"), reviewsController.updateSettings);

router.get("/requests", authorizePermission("marketing:read"), reviewsController.listRequests);

router.post("/requests", authorizePermission("marketing:write"), reviewsController.createRequest);

router.post("/requests/:id/sent", authorizePermission("marketing:write"), reviewsController.markRequestSent);

router.patch("/gbp-checklist/:itemKey", authorizePermission("marketing:write"), reviewsController.updateChecklist);

router.post("/reply-suggestion", authorizePermission("marketing:read"), reviewsController.suggestReply);

// @route   POST /api/reviews/:id/reply-handoff
// @desc    Return direct reply capability or external GBP handoff URL
// @access  Private
router.post("/:id/reply-handoff", authorizePermission("marketing:write"), reviewIdParamValidator, validate, reviewsController.replyHandoff);

// @route   GET /api/reviews
// @desc    List clinic reviews
// @access  Private
router.get("/", authorizePermission("marketing:read"), reviewsController.listReviews);

// @route   PATCH /api/reviews/:id/status
// @desc    Update review status
// @access  Private
router.patch("/:id/status", authorizePermission("marketing:write"), updateReviewStatusValidator, validate, reviewsController.updateReviewStatus);

export default router;
