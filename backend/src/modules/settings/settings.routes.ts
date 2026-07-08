import { Router } from "express";
import { settingsController } from "./settings.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { updatePreferencesValidator, toggle2faValidator } from "./settings.validators.js";

const router = Router();

router.use(authenticate);


// @route: GET /api/settings/preferences
// @desc: Get user preferences
// @access: Private
router.get(
    "/preferences",
    authorizePermission("settings:read"),
    settingsController.getPreferences
);


// @route: PUT /api/settings/preferences
// @desc: Update user preferences
// @access: Private
router.put(
    "/preferences",
    authorizePermission("settings:write"),
    updatePreferencesValidator, validate, 
    settingsController.updatePreferences
);


// @route: PUT /api/settings/security/2fa
// @desc: Enable or disable 2FA
// @access: Private
router.put(
    "/security/2fa",
    authorizePermission("settings:write"),
    toggle2faValidator, validate,  
    settingsController.toggle2FA
);


// @route: GET /api/settings/security
// @desc: Get 2FA status and security info
// @access: Private
router.get(
    "/security",
    authorizePermission("settings:read"),
    settingsController.getSecuritySettings
);


export default router;
