import { Router } from "express";
import { profilesController } from "./profiles.controller.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { updateClinicProfileValidator, updatePatientProfileValidator } from "./profiles.validators.js";

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

// @route: GET /api/profiles/patient/:contactId
// @desc: Get patient profile
// @access: Private(clinic admin, clinic staff, or the patient themselves)
router.get(
    "/patient/:contactId",
    authorizePermission("contacts:read"),
    profilesController.getPatientProfile
);

// @route: PUT /api/profiles/patient/:contactId
// @desc: Update patient profile
// @access: Private(clinic admin, clinic staff, or the patient themselves)
router.put(
    "/patient/:contactId",
    authorizePermission("contacts:write"),
    updatePatientProfileValidator, validate,   
    profilesController.updatePatientProfile
);


export default router;
