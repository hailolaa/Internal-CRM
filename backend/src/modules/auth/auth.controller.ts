import { Request, Response, NextFunction } from "express";
import { authService } from "./auth.service.js";
import { config } from "../../config/index.js";
import { ApiError } from "../../utils/ApiError.js";
import { OAuthProvider } from "./auth.types.js";
import { googleDriveOAuthService } from "../client-accounts/google-drive-oauth.service.js";

function isOAuthProvider(value: string | undefined): value is OAuthProvider {
    return value === "google" || value === "facebook" || value === "apple";
}

function getRequestMeta(req: Request) {
    return {
        ipAddress: req.ip || null,
        userAgent: req.get("user-agent") || null,
    };
}

function redirectOAuthError(res: Response, error: unknown) {
    const frontendUrl = config.frontendUrl.replace(/\/$/, "");
    const message = error instanceof Error ? error.message : "OAuth sign-in failed";
    const params = new URLSearchParams({ error: message });
    res.redirect(`${frontendUrl}/oauth/callback#${params.toString()}`);
}

function redirectDriveOAuthError(res: Response, error: unknown) {
    const frontendUrl = config.frontendUrl.replace(/\/$/, "");
    const message = error instanceof Error ? error.message : "Google Drive connection failed";
    const params = new URLSearchParams({ drive: "error", message });
    res.redirect(`${frontendUrl}/app/integrations?${params.toString()}`);
}

export class AuthController {
    startOAuth = async (req: Request, res: Response, _next: NextFunction) => {
        try {
            const provider = String(req.params.provider || "");
            if (!isOAuthProvider(provider)) {
                throw ApiError.badRequest("Unsupported OAuth provider");
            }
            const mode = req.query.mode === "signup" ? "signup" : "login";
            const rememberMe = req.query.rememberMe === "true";
            const url = authService.getOAuthAuthorizationUrl(provider, mode, rememberMe);
            res.redirect(url);
        } catch (error) {
            redirectOAuthError(res, error);
        }
    };

    oauthCallback = async (req: Request, res: Response) => {
        const provider = String(req.params.provider || "");
        const code = String(req.query.code || req.body?.code || "");
        const state = String(req.query.state || req.body?.state || "");
        const appleUser = typeof req.body?.user === "string" ? req.body.user : undefined;
        const frontendUrl = config.frontendUrl.replace(/\/$/, "");

        try {
            if (!isOAuthProvider(provider)) {
                throw new Error("Unsupported OAuth provider");
            }
            if (provider === "google" && googleDriveOAuthService.isDriveOAuthState(state)) {
                await googleDriveOAuthService.completeOAuth(code, state, getRequestMeta(req));
                res.redirect(`${frontendUrl}/app/integrations?drive=connected`);
                return;
            }
            const result = await authService.handleOAuthCallback(provider, code, state, appleUser, getRequestMeta(req));
            const user = Buffer.from(JSON.stringify(result.user), "utf8").toString("base64url");
            const hash = new URLSearchParams({
                token: result.tokens.token,
                refreshToken: result.tokens.refreshToken || "",
                user,
                isNewUser: String(result.isNewUser),
                rememberMe: String(result.rememberMe),
                requires2FA: String(result.tokens.requires2FA || false),
            });

            res.redirect(`${frontendUrl}/oauth/callback#${hash.toString()}`);
        } catch (error) {
            if (provider === "google" && googleDriveOAuthService.isDriveOAuthState(state)) {
                redirectDriveOAuthError(res, error);
                return;
            }
            redirectOAuthError(res, error);
        }
    };

    // POST /api/auth/register/clinic
    registerClinic = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await authService.registerClinic(req.body, getRequestMeta(req));

            res.status(201).json({
                status: "success",
                data: result,
            });
            
        } catch (error) {
            next(error);
        }
    };


    // POST /api/auth/register/patient
    registerPatient = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await authService.registerPatient(req.body, getRequestMeta(req));
            res.status(201).json({
                status: "success",
                data: result,
            });
        } catch (error) {
            next(error);
        }
    };


    // POST /api/auth/login
    login = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await authService.login(req.body, getRequestMeta(req));
            res.status(200).json({
                status: "success",
                data: result,
            });
        } catch (error) {
            next(error);
        }
    };


    // POST /api/auth/verify-2fa
    verify2fa = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await authService.verify2fa(req.body, getRequestMeta(req));
            res.status(200).json({
                status: "success",
                data: result,
            });
        } catch (error) {
            next(error);
        }
    };


    // POST /api/auth/forgot-password
    forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
        try {
            await authService.forgotPassword(req.body, getRequestMeta(req));

            res.status(200).json({
                status: "success",
                message: "If an account with this email exists, a reset link has been sent.",
            });
            
        } catch (error) {
            next(error);
        }
    };



    // POST /api/auth/reset-password
    resetPassword = async (req: Request, res: Response, next: NextFunction) => {
        try {
            await authService.resetPassword(req.body, getRequestMeta(req));

            res.status(200).json({
                status: "success",
                message: "Password reset successfully. You can now log in with your new password.",
            });
            
        } catch (error) {
            next(error);
        }
    };

    verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
        try {
            await authService.verifyEmail(req.body, getRequestMeta(req));

            res.status(200).json({
                status: "success",
                message: "Email verified successfully.",
            });
        } catch (error) {
            next(error);
        }
    };

    resendVerificationEmail = async (req: Request, res: Response, next: NextFunction) => {
        try {
            await authService.resendVerificationEmail(req.body, getRequestMeta(req));

            res.status(200).json({
                status: "success",
                message: "If an unverified account exists, a verification email has been sent.",
            });
        } catch (error) {
            next(error);
        }
    };

    refresh = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await authService.refresh(req.body.refreshToken, getRequestMeta(req));
            res.status(200).json({
                status: "success",
                data: result,
            });
        } catch (error) {
            next(error);
        }
    };

    me = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;
            const result = await authService.getCurrentSession(user.userId, user.clinicId);
            res.status(200).json({
                status: "success",
                data: result,
            });
        } catch (error) {
            next(error);
        }
    };

    listClinics = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = (req as any).user.userId;
            const clinics = await authService.listClinics(userId);
            res.status(200).json({
                status: "success",
                data: clinics,
            });
        } catch (error) {
            next(error);
        }
    };

    switchClinic = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = (req as any).user.userId;
            const result = await authService.switchClinic(userId, req.body, getRequestMeta(req));
            res.status(200).json({
                status: "success",
                data: result,
            });
        } catch (error) {
            next(error);
        }
    };

    logout = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = (req as any).user.userId;
            await authService.logout(userId, req.body.refreshToken, getRequestMeta(req));
            res.status(200).json({
                status: "success",
                message: "Logged out successfully",
            });
        } catch (error) {
            next(error);
        }
    };

    logoutAll = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = (req as any).user.userId;
            await authService.logoutAll(userId, req.body?.refreshToken, getRequestMeta(req));
            res.status(200).json({
                status: "success",
                message: "All sessions revoked successfully",
            });
        } catch (error) {
            next(error);
        }
    };

    revokeSession = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = (req as any).user.userId;
            await authService.revokeSession(
                userId,
                String(req.params.sessionId),
                req.body?.refreshToken,
                getRequestMeta(req),
            );
            res.status(200).json({
                status: "success",
                message: "Session revoked successfully",
            });
        } catch (error) {
            next(error);
        }
    };

    listSessions = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = (req as any).user.userId;
            const sessions = await authService.listSessions(userId, req.query.refreshToken?.toString());
            res.status(200).json({
                status: "success",
                data: sessions,
            });
        } catch (error) {
            next(error);
        }
    };

    listSecurityEvents = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = (req as any).user.userId;
            const events = await authService.listSecurityEvents(userId);
            res.status(200).json({
                status: "success",
                data: events,
            });
        } catch (error) {
            next(error);
        }
    };
}

export const authController = new AuthController(); 
