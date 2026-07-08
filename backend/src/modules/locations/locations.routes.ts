import { Router } from "express";
import { locationsController } from "./locations.controllers.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import {
  createLocationValidator,
  updateLocationValidator,
  locationIdParamValidator,
} from "./locations.validators.js";

const router = Router();

// All location routes require authentication
router.use(authenticate);

// @route   POST /api/locations
// @desc    Create a new clinic location
// @access  Private (Super Admin Only)
router.post(
  "/",
  authorize("SUPER_ADMIN"),
  createLocationValidator,
  validate,
  locationsController.createLocation
);

// @route   GET /api/locations
// @desc    Get all clinic locations
// @access  Private (All Users)
router.get(
  "/",
  authorize("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF", "READ_ONLY"),
  locationsController.getLocations
);

// @route   PATCH /api/locations/:id
// @desc    Update a location
// @access  Private (Admin / Super Admin)
router.patch(
  "/:id",
  authorize("SUPER_ADMIN", "ADMIN"),
  updateLocationValidator,
  validate,
  locationsController.updateLocation
);

// @route   DELETE /api/locations/:id
// @desc    Soft delete a location
// @access  Private (Super Admin Only)
router.delete(
  "/:id",
  authorize("SUPER_ADMIN"),
  locationIdParamValidator,
  validate,
  locationsController.deleteLocation
);

export default router;
