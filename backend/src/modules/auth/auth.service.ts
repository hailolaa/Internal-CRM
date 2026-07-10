import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
import pool from "../../config/database.js";
import { config } from "../../config/index.js";
import { ApiError } from "../../utils/ApiError.js";
import {
  comparePassword,
  generateOTP,
  generateRefreshToken,
  generateResetToken,
  generateToken,
  hashPassword,
  hashToken,
} from "../../utils/helpers.js";
import { logAuditEvent } from "../../utils/audit.js";
import { emailService } from "../../services/email.service.js";
import {
  AuthRequestMeta,
  AuthResponse,
  ClinicMembershipResponse,
  ForgotPasswordDTO,
  LoginDTO,
  OAuthCallbackResult,
  OAuthProvider,
  OAuthStatePayload,
  RegisterClinicDTO,
  RegisterPatientDTO,
  ResendVerificationEmailDTO,
  ResetPasswordDTO,
  SecurityEventResponse,
  SessionResponse,
  SwitchClinicDTO,
  VerifyEmailDTO,
  Verify2faDTO,
} from "./auth.types.js";

import logger from "../../utils/logger.js";

import { securityService, SecurityService } from "../security/security.service.js";

type TokenUser = {
  id: string;
  clinic_id: string;
  email: string;
  role: string;
  first_name?: string;
  last_name?: string;
  clinic_name?: string | null;
  email_verified_at?: string | Date | null;
};

export class AuthService {
  private readonly accessTokenExpiresIn = "15m";
  private readonly defaultRefreshDays = 7;
  private readonly rememberedRefreshDays = 30;
  private readonly maxFailedLoginAttempts = 5;
  private readonly lockoutMinutes = 15;
  private readonly passwordResetMinutes = 60;
  private readonly emailVerificationHours = 24;

  getOAuthAuthorizationUrl(
    provider: OAuthProvider,
    mode: "login" | "signup",
    rememberMe: boolean,
  ): string {
    if (mode === "signup") {
      throw ApiError.forbidden("Mission Control access is invitation-only. Ask an admin to invite you.");
    }

    const state = jwt.sign({ provider, mode, rememberMe }, config.jwt.secret, {
      expiresIn: "10m",
    });
    const redirectUri = this.getOAuthRedirectUri(provider);

    if (provider === "google") {
      if (!config.oauth.google.clientId) {
        throw ApiError.internal("Google OAuth is not configured");
      }

      const params = new URLSearchParams({
        client_id: config.oauth.google.clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "openid email profile",
        state,
        prompt: "select_account",
      });

      return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }

    if (provider === "facebook") {
      if (!config.oauth.facebook.clientId) {
        throw ApiError.internal("Facebook OAuth is not configured");
      }

      const params = new URLSearchParams({
        client_id: config.oauth.facebook.clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "email,public_profile",
        state,
      });

      return `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`;
    }

    if (!config.oauth.apple.clientId) {
      throw ApiError.internal("Apple OAuth is not configured");
    }

    const params = new URLSearchParams({
      client_id: config.oauth.apple.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      response_mode: "form_post",
      scope: "name email",
      state,
    });

    return `https://appleid.apple.com/auth/authorize?${params.toString()}`;
  }

  async handleOAuthCallback(
    provider: OAuthProvider,
    code: string,
    state: string,
    appleUserJson?: string,
    meta: AuthRequestMeta = {},
  ): Promise<OAuthCallbackResult> {
    const oauthState = this.verifyOAuthState(state);
    if (oauthState.provider !== provider) {
      throw ApiError.badRequest("OAuth provider mismatch");
    }

    const profile = await this.fetchOAuthProfile(provider, code, appleUserJson);
    if (!profile.email) {
      throw ApiError.badRequest("OAuth provider did not return an email address");
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      const [linkedAccounts]: any = await connection.execute(
        "SELECT user_id FROM oauth_account WHERE provider = ? AND provider_user_id = ?",
        [provider, profile.providerUserId],
      );

      let userId = linkedAccounts[0]?.user_id as string | undefined;
      let linkedNow = false;

      if (!userId) {
        const [existingUsers]: any = await connection.execute(
          "SELECT id FROM user WHERE email = ? AND deleted_at IS NULL",
          [profile.email],
        );

        userId = existingUsers[0]?.id;

        if (!userId) {
          throw ApiError.forbidden("Mission Control access is invitation-only. Ask an admin to invite you before using OAuth.");
        }

        await connection.execute(
          "INSERT INTO oauth_account (id, user_id, provider, provider_user_id, email) VALUES (?, ?, ?, ?, ?)",
          [uuidv4(), userId, provider, profile.providerUserId, profile.email],
        );
        linkedNow = true;
      }

      const [users]: any = await connection.execute(
        "SELECT id, clinic_id, email, first_name, last_name, role, email_verified_at FROM user WHERE id = ? AND deleted_at IS NULL",
        [userId],
      );
      const user = users[0] as TokenUser | undefined;
      if (!user) {
        throw ApiError.notFound("User not found");
      }

      await connection.execute(
        `INSERT IGNORE INTO clinic_membership (user_id, clinic_id, role, status, is_primary)
         VALUES (?, ?, ?, 'active', 1)`,
        [user.id, user.clinic_id, user.role],
      );

      await connection.commit();

      const tokens = await this.createTokenPair(user, oauthState.rememberMe, meta);
      await logAuditEvent({
        clinicId: user.clinic_id,
        userId: user.id,
        action: "LOGIN_SUCCESS",
        entityType: "user",
        entityId: user.id,
        changes: { provider },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      if (linkedNow) {
        await logAuditEvent({
          clinicId: user.clinic_id,
          userId: user.id,
          action: "OAUTH_LINKED",
          entityType: "oauth_account",
          changes: { provider, email: profile.email },
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        });
      }

      return {
        isNewUser: false,
        rememberMe: oauthState.rememberMe,
        user: this.toAuthUser(user),
        tokens: {
          ...tokens,
          requires2FA: false,
        },
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async registerClinic(
    data: RegisterClinicDTO,
    meta: AuthRequestMeta = {},
  ): Promise<AuthResponse> {
    void data;
    void meta;
    throw ApiError.forbidden("Public workspace signup is disabled for Mission Control. Ask an admin to invite you.");
  }

  async registerPatient(
    data: RegisterPatientDTO,
    meta: AuthRequestMeta = {},
  ): Promise<AuthResponse> {
    void data;
    void meta;
    throw ApiError.forbidden("Client and prospect self-registration is disabled for Mission Control MVP.");
  }

  async login(data: LoginDTO, meta: AuthRequestMeta = {}): Promise<AuthResponse> {
    const [users]: any = await pool.execute(
      "SELECT * FROM user WHERE email = ? AND deleted_at IS NULL",
      [data.email],
    );
    const user = users[0];
    if (user?.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
      await logAuditEvent({
        clinicId: user.clinic_id,
        userId: user.id,
        action: "LOGIN_LOCKED",
        entityType: "user",
        entityId: user.id,
        changes: { email: data.email, lockedUntil: user.locked_until },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      throw ApiError.unauthorized("Account temporarily locked. Try again later.");
    }

    if (!user || !(await comparePassword(data.password!, user.password_hash))) {
      if (user) {
        await this.recordFailedLogin(user, meta);
      }
      await logAuditEvent({
        clinicId: user?.clinic_id,
        userId: user?.id,
        action: "LOGIN_FAILED",
        entityType: "user",
        entityId: user?.id,
        changes: { email: data.email },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      throw ApiError.unauthorized("Invalid email or password");
    }

    await this.resetLoginLockout(user.id);

    if (user.two_factor_enabled) {
      const otp = generateOTP();
      logger.info(`[2FA DEBUG] OTP for ${user.email}: ${otp}`);
      const token = generateToken(
        {
          userId: user.id,
          clinicId: user.clinic_id,
          role: user.role,
          email: user.email,
        },
        this.accessTokenExpiresIn,
      );

      return {
        user: this.toAuthUser(user),
        tokens: {
          token,
          expiresIn: this.accessTokenExpiresIn,
          requires2FA: true,
        },
      };
    }

    const priorIpAddress = await this.getLastSuccessfulSessionIp(user.id);
    const tokens = await this.createTokenPair(user, data.rememberMe, meta);
    await this.maybeSendUnusualLoginAlert(user, priorIpAddress, meta);
    await logAuditEvent({
      clinicId: user.clinic_id,
      userId: user.id,
      action: "LOGIN_SUCCESS",
      entityType: "user",
      entityId: user.id,
      changes: { rememberMe: !!data.rememberMe },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return {
      user: this.toAuthUser(user),
      tokens: { ...tokens, requires2FA: false },
    };
  }

    async verify2fa(
    data: Verify2faDTO,
    meta: AuthRequestMeta = {},
  ): Promise<AuthResponse> {
    const [users]: any = await pool.execute(
      "SELECT * FROM user WHERE email = ?",
      [data.email],
    );
    const user = users[0];
    if (!user) throw ApiError.notFound("User not found");

    const isValid = await securityService.validate2FA(user.id, data.code);
    if (!isValid) {
      await logAuditEvent({
        clinicId: user.clinic_id,
        userId: user.id,
        action: "TWO_FACTOR_FAILED",
        entityType: "user",
        entityId: user.id,
        changes: { email: data.email },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      throw ApiError.unauthorized("Invalid 2FA code");
    }

    const tokens = await this.createTokenPair(user, data.rememberMe, meta);
    await logAuditEvent({
      clinicId: user.clinic_id,
      userId: user.id,
      action: "LOGIN_2FA_SUCCESS",
      entityType: "user",
      entityId: user.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return {
      user: this.toAuthUser(user),
      tokens: { ...tokens, requires2FA: false },
    };
  }


  async forgotPassword(
    data: ForgotPasswordDTO,
    meta: AuthRequestMeta = {},
  ): Promise<void> {
    const [users]: any = await pool.execute(
      "SELECT id, clinic_id FROM user WHERE email = ?",
      [data.email],
    );
    const user = users[0];

    if (!user) return;

    const token = generateResetToken();
    const expiresAt = new Date(Date.now() + this.passwordResetMinutes * 60 * 1000);
    await pool.execute(
      "UPDATE tokens SET revoked = 1, used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND token_type = 'reset_password' AND revoked = 0",
      [user.id],
    );
    await pool.execute(
      `INSERT INTO tokens
          (id, user_id, token_hash, token_type, expires_at, ip_address, user_agent)
       VALUES (?, ?, ?, 'reset_password', ?, ?, ?)`,
      [
        uuidv4(),
        user.id,
        hashToken(token),
        expiresAt,
        meta.ipAddress || null,
        meta.userAgent?.slice(0, 255) || null,
      ],
    );

    const resetUrl = `${config.frontendUrl.replace(/\/$/, "")}/reset-password?email=${encodeURIComponent(data.email)}&token=${encodeURIComponent(token)}`;
    await emailService.sendPasswordResetEmail({
      email: data.email,
      resetUrl,
      expiresMinutes: this.passwordResetMinutes,
    });

    await logAuditEvent({
      clinicId: user.clinic_id,
      userId: user.id,
      action: "PASSWORD_RESET_REQUESTED",
      entityType: "user",
      entityId: user.id,
      changes: { email: data.email, expiresAt },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }

  async resetPassword(
    data: ResetPasswordDTO,
    meta: AuthRequestMeta = {},
  ): Promise<void> {
    const [users]: any = await pool.execute(
      "SELECT id, clinic_id FROM user WHERE email = ?",
      [data.email],
    );
    const user = users[0];
    if (!user) {
      throw ApiError.notFound("User not found");
    }

    const tokenHash = hashToken(data.token);
    const [tokens]: any = await pool.execute(
      `SELECT id FROM tokens
       WHERE user_id = ?
         AND token_hash = ?
         AND token_type = 'reset_password'
         AND revoked = 0
         AND used_at IS NULL
         AND expires_at > CURRENT_TIMESTAMP`,
      [user.id, tokenHash],
    );

    if (!tokens[0]) {
      throw ApiError.badRequest("Password reset link is invalid or expired");
    }

    const hashedPassword = await hashPassword(data.newPassword);
    await pool.execute("UPDATE user SET password_hash = ? WHERE id = ?", [
      hashedPassword,
      user.id,
    ]);
    await pool.execute(
      "UPDATE tokens SET revoked = 1, used_at = CURRENT_TIMESTAMP WHERE id = ?",
      [tokens[0].id],
    );
    await pool.execute(
      "UPDATE tokens SET revoked = 1, used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND token_type = 'refresh' AND revoked = 0",
      [user.id],
    );
    await logAuditEvent({
      clinicId: user.clinic_id,
      userId: user.id,
      action: "PASSWORD_RESET_COMPLETED",
      entityType: "user",
      entityId: user.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }

  async verifyEmail(
    data: VerifyEmailDTO,
    meta: AuthRequestMeta = {},
  ): Promise<void> {
    const [users]: any = await pool.execute(
      "SELECT id, clinic_id, email_verified_at FROM user WHERE email = ? AND deleted_at IS NULL",
      [data.email],
    );
    const user = users[0];
    if (!user) {
      throw ApiError.badRequest("Email verification link is invalid or expired");
    }

    if (user.email_verified_at) {
      return;
    }

    const tokenHash = hashToken(data.token);
    const [tokens]: any = await pool.execute(
      `SELECT id FROM tokens
       WHERE user_id = ?
         AND token_hash = ?
         AND token_type = 'email_verify'
         AND revoked = 0
         AND used_at IS NULL
         AND expires_at > CURRENT_TIMESTAMP`,
      [user.id, tokenHash],
    );

    if (!tokens[0]) {
      throw ApiError.badRequest("Email verification link is invalid or expired");
    }

    await pool.execute(
      "UPDATE user SET email_verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [user.id],
    );
    await pool.execute(
      "UPDATE tokens SET revoked = 1, used_at = CURRENT_TIMESTAMP WHERE id = ?",
      [tokens[0].id],
    );
    await logAuditEvent({
      clinicId: user.clinic_id,
      userId: user.id,
      action: "EMAIL_VERIFIED",
      entityType: "user",
      entityId: user.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }

  async resendVerificationEmail(
    data: ResendVerificationEmailDTO,
    meta: AuthRequestMeta = {},
  ): Promise<void> {
    const [users]: any = await pool.execute(
      "SELECT id, clinic_id, email, first_name, last_name, role, email_verified_at FROM user WHERE email = ? AND deleted_at IS NULL",
      [data.email],
    );
    const user = users[0];
    if (!user || user.email_verified_at) {
      return;
    }

    await this.sendEmailVerification(user, meta);
    await logAuditEvent({
      clinicId: user.clinic_id,
      userId: user.id,
      action: "EMAIL_VERIFICATION_RESENT",
      entityType: "user",
      entityId: user.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }

  async refresh(
    refreshToken: string,
    meta: AuthRequestMeta = {},
  ): Promise<AuthResponse> {
    const tokenHash = hashToken(refreshToken);
    const [rows]: any = await pool.execute(
      `SELECT id, user_id as userId, active_clinic_id as activeClinicId, expires_at as expiresAt, revoked
       FROM tokens
       WHERE token_hash = ? AND token_type = 'refresh'
       LIMIT 1`,
      [tokenHash],
    );
    const stored = rows[0];
    if (!stored) {
      throw ApiError.unauthorized("Invalid or expired refresh token");
    }

    if (stored.revoked) {
      await this.revokeAllRefreshTokensForReuse(stored.userId, meta);
      throw ApiError.unauthorized("Refresh token reuse detected. All sessions were revoked.");
    }

    if (new Date(stored.expiresAt).getTime() <= Date.now()) {
      await pool.execute(
        "UPDATE tokens SET revoked = 1, used_at = CURRENT_TIMESTAMP WHERE id = ?",
        [stored.id],
      );
      throw ApiError.unauthorized("Invalid or expired refresh token");
    }

    const user = await this.getUserForToken(stored.userId, stored.activeClinicId || undefined);
    if (!user) {
      throw ApiError.unauthorized("Invalid refresh token");
    }

    const rotatedRefreshToken = generateRefreshToken();
    const expiresAt = new Date(stored.expiresAt);
    const rotatedTokenId = uuidv4();

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      const [rotationResult]: any = await connection.execute(
        `UPDATE tokens
         SET revoked = 1, used_at = CURRENT_TIMESTAMP, ip_address = ?, user_agent = ?,
             replaced_by_token_id = ?
         WHERE id = ? AND revoked = 0`,
        [
          meta.ipAddress || null,
          meta.userAgent?.slice(0, 255) || null,
          rotatedTokenId,
          stored.id,
        ],
      );

      if (rotationResult.affectedRows !== 1) {
        throw ApiError.unauthorized("Refresh token reuse detected");
      }

      await connection.execute(
        `INSERT INTO tokens
            (id, user_id, active_clinic_id, token_hash, token_type, expires_at, ip_address, user_agent)
         VALUES (?, ?, ?, ?, 'refresh', ?, ?, ?)`,
        [
          rotatedTokenId,
          user.id,
          user.clinic_id,
          hashToken(rotatedRefreshToken),
          expiresAt,
          meta.ipAddress || null,
          meta.userAgent?.slice(0, 255) || null,
        ],
      );

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      if (
        error instanceof ApiError &&
        error.message === "Refresh token reuse detected"
      ) {
        await this.revokeAllRefreshTokensForReuse(user.id, meta);
      }
      throw error;
    } finally {
      connection.release();
    }

    const token = generateToken(
      {
        userId: user.id,
        clinicId: user.clinic_id,
        role: user.role,
        email: user.email,
      },
      this.accessTokenExpiresIn,
    );

    return {
      user: this.toAuthUser(user),
      clinics: await this.listClinics(user.id),
      tokens: {
        token,
        refreshToken: rotatedRefreshToken,
        expiresIn: this.accessTokenExpiresIn,
        requires2FA: false,
      },
    };
  }

  async listClinics(userId: string): Promise<ClinicMembershipResponse[]> {
    const [rows]: any = await pool.execute(
      `SELECT c.id,
              c.name,
              c.subscription_plan as plan,
              c.subscription_status as status,
              c.city,
              c.country,
              cm.role,
              cm.is_primary as isPrimary
       FROM clinic_membership cm
       INNER JOIN clinic c
         ON c.id = cm.clinic_id
        AND c.deleted_at IS NULL
       INNER JOIN user u
         ON u.id = cm.user_id
        AND u.deleted_at IS NULL
        AND u.status = 'active'
        AND u.is_active = 1
       WHERE cm.user_id = ?
         AND cm.status = 'active'
       ORDER BY cm.is_primary DESC, c.name ASC`,
      [userId],
    );

    return rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      plan: row.plan || null,
      status: row.status || "active",
      role: row.role,
      location: [row.city, row.country].filter(Boolean).join(", ") || null,
      isPrimary: !!row.isPrimary,
    }));
  }

  async getCurrentSession(userId: string, clinicId: string): Promise<Omit<AuthResponse, "tokens">> {
    const user = await this.getUserForToken(userId, clinicId);
    if (!user) {
      throw ApiError.unauthorized("Authentication required");
    }

    return {
      user: this.toAuthUser(user),
      clinics: await this.listClinics(userId),
    };
  }

  async switchClinic(
    userId: string,
    data: SwitchClinicDTO,
    meta: AuthRequestMeta = {},
  ): Promise<AuthResponse> {
    const user = await this.getUserForToken(userId, data.clinicId);
    if (!user) {
      throw ApiError.forbidden("You do not have access to this clinic");
    }

    if (data.refreshToken) {
      await pool.execute(
        "UPDATE tokens SET revoked = 1, used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND token_hash = ? AND token_type = 'refresh'",
        [userId, hashToken(data.refreshToken)],
      );
    }

    const tokens = await this.createTokenPair(user, data.rememberMe, meta);
    await logAuditEvent({
      clinicId: user.clinic_id,
      userId,
      action: "CLINIC_SWITCHED",
      entityType: "clinic",
      entityId: user.clinic_id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return {
      user: this.toAuthUser(user),
      clinics: await this.listClinics(userId),
      tokens: { ...tokens, requires2FA: false },
    };
  }

  async logout(
    userId: string,
    refreshToken?: string,
    meta: AuthRequestMeta = {},
  ): Promise<void> {
    if (refreshToken) {
      await pool.execute(
        "UPDATE tokens SET revoked = 1, used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND token_hash = ? AND token_type = 'refresh'",
        [userId, hashToken(refreshToken)],
      );
    }
    const user = await this.getUserForToken(userId);
    await logAuditEvent({
      clinicId: user?.clinic_id,
      userId,
      action: "LOGOUT",
      entityType: "user",
      entityId: userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }

  async logoutAll(
    userId: string,
    currentRefreshToken?: string,
    meta: AuthRequestMeta = {},
  ): Promise<void> {
    if (currentRefreshToken) {
      await pool.execute(
        "UPDATE tokens SET revoked = 1, used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND token_type = 'refresh' AND revoked = 0 AND token_hash <> ?",
        [userId, hashToken(currentRefreshToken)],
      );
    } else {
      await pool.execute(
        "UPDATE tokens SET revoked = 1, used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND token_type = 'refresh' AND revoked = 0",
        [userId],
      );
    }
    const user = await this.getUserForToken(userId);
    await logAuditEvent({
      clinicId: user?.clinic_id,
      userId,
      action: "LOGOUT_ALL",
      entityType: "user",
      entityId: userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }

  async revokeSession(
    userId: string,
    sessionId: string,
    currentRefreshToken?: string,
    meta: AuthRequestMeta = {},
  ): Promise<void> {
    const currentHash = currentRefreshToken ? hashToken(currentRefreshToken) : null;

    const [sessions]: any = await pool.execute(
      `SELECT id, token_hash as tokenHash, revoked
       FROM tokens
       WHERE id = ? AND user_id = ? AND token_type = 'refresh'
       LIMIT 1`,
      [sessionId, userId],
    );
    const session = sessions[0];
    if (!session) {
      throw ApiError.notFound("Session not found");
    }
    if (currentHash && session.tokenHash === currentHash) {
      throw ApiError.badRequest("Use logout to revoke your current session");
    }

    if (!session.revoked) {
      await pool.execute(
        "UPDATE tokens SET revoked = 1, used_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
        [sessionId, userId],
      );
    }

    const user = await this.getUserForToken(userId);
    await logAuditEvent({
      clinicId: user?.clinic_id,
      userId,
      action: "SESSION_REVOKED",
      entityType: "tokens",
      entityId: sessionId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }

  async listSessions(
    userId: string,
    currentRefreshToken?: string,
  ): Promise<SessionResponse[]> {
    const currentHash = currentRefreshToken ? hashToken(currentRefreshToken) : null;
    const [rows]: any = await pool.execute(
      `SELECT id, token_hash as tokenHash, expires_at as expiresAt, created_at as createdAt,
              used_at as usedAt, revoked, ip_address as ipAddress, user_agent as userAgent
       FROM tokens
       WHERE user_id = ?
         AND token_type = 'refresh'
         AND revoked = 0
         AND expires_at > CURRENT_TIMESTAMP
       ORDER BY created_at DESC
       LIMIT 20`,
      [userId],
    );

    return rows.map((row: any) => ({
      id: row.id,
      createdAt: new Date(row.createdAt).toISOString(),
      expiresAt: new Date(row.expiresAt).toISOString(),
      usedAt: row.usedAt ? new Date(row.usedAt).toISOString() : null,
      revoked: !!row.revoked,
      ipAddress: row.ipAddress ? String(row.ipAddress) : null,
      userAgent: row.userAgent || null,
      current: currentHash === row.tokenHash,
    }));
  }

  async listSecurityEvents(userId: string): Promise<SecurityEventResponse[]> {
    const user = await this.getUserForToken(userId);
    const [rows]: any = await pool.execute(
      `SELECT id, action, entity_type as entityType, entity_id as entityId, changes,
              ip_address as ipAddress, user_agent as userAgent, created_at as createdAt
       FROM audit_log
       WHERE user_id = ?
          OR (clinic_id = ? AND action IN (
            'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGIN_LOCKED', 'LOGIN_2FA_SUCCESS',
            'LOGOUT', 'LOGOUT_ALL', 'SESSION_REVOKED', 'REFRESH_TOKEN_REUSE',
            'SECURITY_ALERT', 'TWO_FACTOR_ENABLED', 'TWO_FACTOR_DISABLED'
          ))
       ORDER BY created_at DESC
       LIMIT 25`,
      [userId, user?.clinic_id || null],
    );

    return rows.map((row: any) => ({
      id: row.id,
      action: row.action,
      entityType: row.entityType || null,
      entityId: row.entityId || null,
      changes: this.parseAuditChanges(row.changes),
      ipAddress: row.ipAddress ? String(row.ipAddress) : null,
      userAgent: row.userAgent || null,
      createdAt: new Date(row.createdAt).toISOString(),
    }));
  }

  private async createTokenPair(
    user: TokenUser,
    rememberMe = false,
    meta: AuthRequestMeta = {},
  ) {
    const token = generateToken(
      {
        userId: user.id,
        clinicId: user.clinic_id,
        role: user.role,
        email: user.email,
      },
      this.accessTokenExpiresIn,
    );
    const refreshToken = generateRefreshToken();
    const refreshDays = rememberMe
      ? this.rememberedRefreshDays
      : this.defaultRefreshDays;
    const expiresAt = new Date(Date.now() + refreshDays * 24 * 60 * 60 * 1000);

    await pool.execute(
      `INSERT INTO tokens
          (id, user_id, active_clinic_id, token_hash, token_type, expires_at, ip_address, user_agent)
       VALUES (?, ?, ?, ?, 'refresh', ?, ?, ?)`,
      [
        uuidv4(),
        user.id,
        user.clinic_id,
        hashToken(refreshToken),
        expiresAt,
        meta.ipAddress || null,
        meta.userAgent?.slice(0, 255) || null,
      ],
    );

    return {
      token,
      refreshToken,
      expiresIn: this.accessTokenExpiresIn,
    };
  }

  private async sendEmailVerification(
    user: TokenUser,
    meta: AuthRequestMeta = {},
  ) {
    const token = generateResetToken();
    const expiresAt = new Date(
      Date.now() + this.emailVerificationHours * 60 * 60 * 1000,
    );

    await pool.execute(
      "UPDATE tokens SET revoked = 1, used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND token_type = 'email_verify' AND revoked = 0",
      [user.id],
    );
    await pool.execute(
      `INSERT INTO tokens
          (id, user_id, token_hash, token_type, expires_at, ip_address, user_agent)
       VALUES (?, ?, ?, 'email_verify', ?, ?, ?)`,
      [
        uuidv4(),
        user.id,
        hashToken(token),
        expiresAt,
        meta.ipAddress || null,
        meta.userAgent?.slice(0, 255) || null,
      ],
    );

    const verifyUrl = `${config.frontendUrl.replace(/\/$/, "")}/verify-email?email=${encodeURIComponent(user.email)}&token=${encodeURIComponent(token)}`;
    try {
      await emailService.sendEmailVerificationEmail({
        email: user.email,
        verifyUrl,
        expiresHours: this.emailVerificationHours,
      });
    } catch (error) {
      logger.error("Failed to send email verification", {
        userId: user.id,
        email: user.email,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async getUserForToken(
    userId: string,
    clinicId?: string,
  ): Promise<TokenUser | undefined> {
    const [users]: any = await pool.execute(
      `SELECT u.id,
              cm.clinic_id,
              u.email,
              u.first_name,
              u.last_name,
              COALESCE(cm.role, u.role) as role,
              c.name as clinic_name,
              u.email_verified_at
       FROM user u
       INNER JOIN clinic_membership cm
         ON cm.user_id = u.id
        AND cm.status = 'active'
        AND cm.clinic_id = COALESCE(?, u.clinic_id)
       INNER JOIN clinic c
         ON c.id = cm.clinic_id
        AND c.deleted_at IS NULL
       WHERE u.id = ?
         AND u.deleted_at IS NULL
         AND u.status = 'active'
         AND u.is_active = 1
       LIMIT 1`,
      [clinicId || null, userId],
    );
    return users[0];
  }

  private async recordFailedLogin(user: any, meta: AuthRequestMeta) {
    const failedCount = Number(user.failed_login_count || 0) + 1;
    const shouldLock = failedCount >= this.maxFailedLoginAttempts;
    const lockedUntil = shouldLock
      ? new Date(Date.now() + this.lockoutMinutes * 60 * 1000)
      : null;

    await pool.execute(
      `UPDATE user
       SET failed_login_count = ?,
           locked_until = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [failedCount, lockedUntil, user.id],
    );

    if (shouldLock) {
      await pool.execute(
        "UPDATE tokens SET revoked = 1, used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND token_type = 'refresh' AND revoked = 0",
        [user.id],
      );
      await logAuditEvent({
        clinicId: user.clinic_id,
        userId: user.id,
        action: "SECURITY_ALERT",
        entityType: "user",
        entityId: user.id,
        changes: {
          type: "ACCOUNT_LOCKED",
          failedLoginCount: failedCount,
          lockedUntil,
        },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      logger.warn("[SECURITY EMAIL ALERT] Account lockout alert queued", {
        email: user.email,
        userId: user.id,
        lockedUntil,
      });
    }
  }

  private async resetLoginLockout(userId: string) {
    await pool.execute(
      `UPDATE user
       SET failed_login_count = 0,
           locked_until = NULL,
           last_login = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [userId],
    );
  }

  private async getLastSuccessfulSessionIp(userId: string) {
    const [rows]: any = await pool.execute(
      `SELECT ip_address as ipAddress
       FROM tokens
       WHERE user_id = ? AND token_type = 'refresh' AND ip_address IS NOT NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId],
    );
    return rows[0]?.ipAddress ? String(rows[0].ipAddress) : null;
  }

  private async maybeSendUnusualLoginAlert(
    user: TokenUser,
    priorIpAddress: string | null,
    meta: AuthRequestMeta,
  ) {
    if (!priorIpAddress || !meta.ipAddress || priorIpAddress === meta.ipAddress) {
      return;
    }

    await logAuditEvent({
      clinicId: user.clinic_id,
      userId: user.id,
      action: "SECURITY_ALERT",
      entityType: "user",
      entityId: user.id,
      changes: {
        type: "UNUSUAL_LOGIN",
        previousIpAddress: priorIpAddress,
        newIpAddress: meta.ipAddress,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    logger.warn("[SECURITY EMAIL ALERT] Unusual login alert queued", {
      email: user.email,
      userId: user.id,
      previousIpAddress: priorIpAddress,
      newIpAddress: meta.ipAddress,
    });
  }

  private async revokeAllRefreshTokensForReuse(
    userId: string,
    meta: AuthRequestMeta,
  ) {
    await pool.execute(
      "UPDATE tokens SET revoked = 1, used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND token_type = 'refresh' AND revoked = 0",
      [userId],
    );
    const user = await this.getUserForToken(userId);
    await logAuditEvent({
      clinicId: user?.clinic_id,
      userId,
      action: "REFRESH_TOKEN_REUSE",
      entityType: "tokens",
      changes: { outcome: "ALL_SESSIONS_REVOKED" },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    logger.warn("[SECURITY EMAIL ALERT] Refresh token reuse alert queued", {
      userId,
      email: user?.email,
    });
  }

  private parseAuditChanges(changes: unknown) {
    if (!changes) return null;
    if (typeof changes === "object") return changes as Record<string, unknown>;
    try {
      return JSON.parse(String(changes)) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private toAuthUser(user: TokenUser) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.first_name || "",
      lastName: user.last_name || "",
      role: user.role,
      clinicId: user.clinic_id,
      clinicName: user.clinic_name || null,
      emailVerifiedAt: (user as any).email_verified_at
        ? new Date((user as any).email_verified_at).toISOString()
        : null,
    };
  }

  private getOAuthRedirectUri(provider: OAuthProvider): string {
    return `${config.oauthCallbackBaseUrl.replace(/\/$/, "")}/oauth/${provider}/callback`;
  }

  private verifyOAuthState(state: string): OAuthStatePayload {
    try {
      return jwt.verify(state, config.jwt.secret) as OAuthStatePayload;
    } catch {
      throw ApiError.badRequest("Invalid or expired OAuth state");
    }
  }

  private async fetchOAuthProfile(
    provider: OAuthProvider,
    code: string,
    appleUserJson?: string,
  ) {
    if (provider === "google") {
      return this.fetchGoogleProfile(code);
    }

    if (provider === "facebook") {
      return this.fetchFacebookProfile(code);
    }

    return this.fetchAppleProfile(code, appleUserJson);
  }

  private async fetchGoogleProfile(code: string) {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.oauth.google.clientId,
        client_secret: config.oauth.google.clientSecret,
        redirect_uri: this.getOAuthRedirectUri("google"),
        grant_type: "authorization_code",
      }),
    });

    const tokenPayload: any = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenPayload.access_token) {
      throw ApiError.unauthorized("Google OAuth token exchange failed");
    }

    const profileResponse = await fetch(
      "https://openidconnect.googleapis.com/v1/userinfo",
      {
        headers: { Authorization: `Bearer ${tokenPayload.access_token}` },
      },
    );
    const profile: any = await profileResponse.json();
    if (!profileResponse.ok || !profile.sub) {
      throw ApiError.unauthorized("Google OAuth profile lookup failed");
    }

    return {
      providerUserId: profile.sub as string,
      email: profile.email as string,
      firstName: (profile.given_name || "") as string,
      lastName: (profile.family_name || "") as string,
    };
  }

  private async fetchFacebookProfile(code: string) {
    const redirectUri = this.getOAuthRedirectUri("facebook");
    const tokenParams = new URLSearchParams({
      client_id: config.oauth.facebook.clientId,
      client_secret: config.oauth.facebook.clientSecret,
      redirect_uri: redirectUri,
      code,
    });
    const tokenResponse = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?${tokenParams.toString()}`,
    );
    const tokenPayload: any = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenPayload.access_token) {
      throw ApiError.unauthorized("Facebook OAuth token exchange failed");
    }

    const profileParams = new URLSearchParams({
      fields: "id,email,first_name,last_name",
      access_token: tokenPayload.access_token,
    });
    const profileResponse = await fetch(
      `https://graph.facebook.com/me?${profileParams.toString()}`,
    );
    const profile: any = await profileResponse.json();
    if (!profileResponse.ok || !profile.id) {
      throw ApiError.unauthorized("Facebook OAuth profile lookup failed");
    }

    return {
      providerUserId: profile.id as string,
      email: profile.email as string,
      firstName: (profile.first_name || "") as string,
      lastName: (profile.last_name || "") as string,
    };
  }

  private async fetchAppleProfile(code: string, appleUserJson?: string) {
    if (
      !config.oauth.apple.teamId ||
      !config.oauth.apple.keyId ||
      !config.oauth.apple.privateKey
    ) {
      throw ApiError.internal("Apple OAuth is not fully configured");
    }

    const clientSecret = jwt.sign(
      {
        iss: config.oauth.apple.teamId,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 60 * 60,
        aud: "https://appleid.apple.com",
        sub: config.oauth.apple.clientId,
      },
      config.oauth.apple.privateKey,
      {
        algorithm: "ES256",
        keyid: config.oauth.apple.keyId,
      },
    );

    const tokenResponse = await fetch("https://appleid.apple.com/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.oauth.apple.clientId,
        client_secret: clientSecret,
        redirect_uri: this.getOAuthRedirectUri("apple"),
        grant_type: "authorization_code",
      }),
    });
    const tokenPayload: any = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenPayload.id_token) {
      throw ApiError.unauthorized("Apple OAuth token exchange failed");
    }

    const decoded = jwt.decode(tokenPayload.id_token) as {
      sub?: string;
      email?: string;
    } | null;
    let firstName = "";
    let lastName = "";

    if (appleUserJson) {
      try {
        const appleUser = JSON.parse(appleUserJson);
        firstName = appleUser?.name?.firstName || "";
        lastName = appleUser?.name?.lastName || "";
      } catch {
        // Apple only sends name on first consent; ignore malformed optional profile JSON.
      }
    }

    if (!decoded?.sub || !decoded.email) {
      throw ApiError.unauthorized("Apple OAuth profile lookup failed");
    }

    return {
      providerUserId: decoded.sub,
      email: decoded.email,
      firstName,
      lastName,
    };
  }
}

export const authService = new AuthService();
