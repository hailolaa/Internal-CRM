import { Router } from "express";
import { profilesController } from "./profiles.controller.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { updateClinicProfileValidator } from "./profiles.validators.js";
import { ApiError } from "../../utils/ApiError.js";

const router = Router();

router.use(authenticate);


// @route: GET /api/profiles/clinic
// @desc: Get clinic profile
// @access: Private(clinic admin, clinic staff)
router.get(
    "/clinic",
    authorizePermission("settings:read"),
    profilesController.getClinicProfile
);

// @route: PUT /api/profiles/clinic
// @desc: Update clinic profile
// @access: Private(clinic admin only)
router.put(
    "/clinic",
    authorizePermission("settings:write"),
    updateClinicProfileValidator, validate,   
    profilesController.updateClinicProfile
);

// The inherited clinic-facing patient profile contract is intentionally retired.
// Internal contact records are available through the permissioned /api/contacts API.
router.all("/patient/:contactId", (_req, _res, next) => {
    next(new ApiError(410, "This legacy profile endpoint is retired. Use the internal contacts workspace."));
});


export default router;
