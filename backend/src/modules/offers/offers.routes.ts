import { Router } from "express";
import { offersController } from "./offers.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { createOfferValidator, offerIdParamValidator, updateOfferValidator } from "./offers.validators.js";

const router = Router();

router.use(authenticate);

// @route   GET /api/offers
// @desc    List marketing offers
// @access  Private
router.get("/", authorizePermission("marketing:read"), offersController.listOffers);

// @route   POST /api/offers
// @desc    Create a marketing offer
// @access  Private
router.post("/", authorizePermission("marketing:write"), createOfferValidator, validate, offersController.createOffer);

// @route   PATCH /api/offers/:id
// @desc    Update a marketing offer
// @access  Private
router.patch("/:id", authorizePermission("marketing:write"), updateOfferValidator, validate, offersController.updateOffer);

// @route   DELETE /api/offers/:id
// @desc    Soft delete a marketing offer
// @access  Private
router.delete("/:id", authorizePermission("marketing:write"), offerIdParamValidator, validate, offersController.deleteOffer);

export default router;
