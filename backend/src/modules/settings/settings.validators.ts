import { body } from "express-validator";

export const updatePreferencesValidator = [
    body("theme").optional().isString().isIn(["light", "dark", "system"]).withMessage("Theme must be light, dark, or system"),
    body("language").optional().isString().isLength({min: 2, max: 10}).withMessage("Invalid language code"),
    body("notificationsEnabled").optional().isBoolean().withMessage("notificationsEnabled must be a boolean"),
    body("emailNotifications").optional().isBoolean().withMessage("emailNotifications must be a boolean"),
    body("smsNotifications").optional().isBoolean().withMessage("smsNotifications must be a boolean"),
];


export const toggle2faValidator = [
    body("twoFactorEnabled").exists().withMessage("twoFactorEnabled is required").isBoolean().withMessage("twoFactorEnabled must be a boolean"),
];