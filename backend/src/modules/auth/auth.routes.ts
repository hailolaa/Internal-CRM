import { Router } from "express";
import { authController } from "./auth.controller.js";
import { validate } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authRateLimit, oauthRateLimit, refreshTokenRateLimit, sensitiveAuthRateLimit } from "../../middleware/rateLimit.js";
import { registerClinicValidator, registerPatientValidator, loginValidator, verify2faValidator, forgotPasswordValidator, resetPasswordValidator, verifyEmailValidator, resendVerificationEmailValidator, refreshTokenValidator, logoutValidator, revokeSessionValidator, switchClinicValidator } from "./auth.validators.js";

const router = Router();

// @desc Redirect to OAuth provider
// @route GET /api/auth/oauth/:provider
// @access Public
router.get("/oauth/:provider", oauthRateLimit, authController.startOAuth);

// @desc OAuth provider callback
// @route GET|POST /api/auth/oauth/:provider/callback
// @access Public
router.get("/oauth/:provider/callback", oauthRateLimit, authController.oauthCallback);
router.post("/oauth/:provider/callback", oauthRateLimit, authController.oauthCallback);

// @desc Register new clinic
// @route POST /api/auth/register/clinic
// @access Public
router.post("/register/clinic",
    authRateLimit,
    registerClinicValidator, validate, 
    authController.registerClinic
);


// @desc Register new patient
// @route POST /api/auth/register/patient
// @access Public
router.post("/register/patient",
    authRateLimit,
    registerPatientValidator, validate,
    authController.registerPatient
);


// @desc Authenticate user and generate tokens
// @route POST /api/auth/login
// @access Public
router.post("/login", 
    sensitiveAuthRateLimit,
    loginValidator, validate, 
    authController.login
);


// @desc Verify 2FA token
// @route POST /api/auth/verify-2fa
// @access Public
router.post("/verify-2fa",
    sensitiveAuthRateLimit,
    verify2faValidator, validate,
    authController.verify2fa
);

// @desc Refresh access token
// @route POST /api/auth/refresh
// @access Public
router.post("/refresh",
    refreshTokenRateLimit,
    refreshTokenValidator, validate,
    authController.refresh
);

// @desc Return the current authenticated user and clinic memberships
// @route GET /api/auth/me
// @access Private
router.get("/me",
    authenticate,
    authController.me
);

// @desc List clinics available to the current user
// @route GET /api/auth/clinics
// @access Private
router.get("/clinics",
    authenticate,
    authController.listClinics
);

// @desc Switch the current authenticated clinic scope
// @route POST /api/auth/switch-clinic
// @access Private
router.post("/switch-clinic",
    authenticate,
    switchClinicValidator, validate,
    authController.switchClinic
);

// @desc Logout current session
// @route POST /api/auth/logout
// @access Private
router.post("/logout",
    authenticate,
    logoutValidator, validate,
    authController.logout
);

// @desc Revoke all sessions
// @route POST /api/auth/logout-all
// @access Private
router.post("/logout-all",
    authenticate,
    authController.logoutAll
);

// @desc List refresh-token sessions
// @route GET /api/auth/sessions
// @access Private
router.get("/sessions",
    authenticate,
    authController.listSessions
);

// @desc Revoke one refresh-token session
// @route DELETE /api/auth/sessions/:sessionId
// @access Private
router.delete("/sessions/:sessionId",
    authenticate,
    revokeSessionValidator, validate,
    authController.revokeSession
);

// @desc List current user's auth/security audit events
// @route GET /api/auth/security-events
// @access Private
router.get("/security-events",
    authenticate,
    authController.listSecurityEvents
);


// @desc Generate a password reset token
// @route POST /api/auth/forgot-password
// @access Public
router.post("/forgot-password", 
    sensitiveAuthRateLimit,
    forgotPasswordValidator, validate, 
    authController.forgotPassword
);


// @desc Reset password
// @route POST /api/auth/reset-password
// @access Public
router.post("/reset-password", 
    sensitiveAuthRateLimit,
    resetPasswordValidator, validate, 
    authController.resetPassword
);

// @desc Verify account email
// @route POST /api/auth/verify-email
// @access Public
router.post("/verify-email",
    sensitiveAuthRateLimit,
    verifyEmailValidator, validate,
    authController.verifyEmail
);

// @desc Resend account verification email
// @route POST /api/auth/resend-verification-email
// @access Public
router.post("/resend-verification-email",
    sensitiveAuthRateLimit,
    resendVerificationEmailValidator, validate,
    authController.resendVerificationEmail
);

export default router;
