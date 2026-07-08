import { generateSecret, generateURI, verifySync } from "otplib";
import * as QRCode from "qrcode";
import pool from "../../config/database.js";
import { ApiError } from "../../utils/ApiError.js";
import { comparePassword, hashPassword } from "../../utils/helpers.js";
import crypto from "crypto";

export class SecurityService {
  // Generate a TOTP secret and QR code for the user to scan
  async setup2FA(userId: string, clinicName: string) {
    const [users]: any = await pool.execute(
      "SELECT email, two_factor_enabled FROM user WHERE id = ? AND deleted_at IS NULL",
      [userId]
    );
    const user = users[0];
    if (!user) throw ApiError.notFound("User not found");
    if (user.two_factor_enabled) throw ApiError.badRequest("2FA is already enabled");

    const secret = generateSecret();
    const otpAuthUrl = generateURI({
      strategy: "totp",
      secret,
      label: user.email,
      issuer: clinicName || "ClinicGrower",
    });
    const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);

    // Store the secret temporarily (not yet enabled)
    await pool.execute(
      "UPDATE user SET two_factor_secret = ? WHERE id = ?",
      [secret, userId]
    );

    return {
      secret,
      qrCode: qrCodeDataUrl,
    };
  }

  // Verify the TOTP token and enable 2FA
  async enable2FA(userId: string, token: string) {
    const [users]: any = await pool.execute(
      "SELECT two_factor_secret, two_factor_enabled FROM user WHERE id = ? AND deleted_at IS NULL",
      [userId]
    );
    const user = users[0];
    if (!user) throw ApiError.notFound("User not found");
    if (user.two_factor_enabled) throw ApiError.badRequest("2FA is already enabled");
    if (!user.two_factor_secret) throw ApiError.badRequest("Run setup first");

    const result = verifySync({ token, secret: user.two_factor_secret });
    if (!result.valid) throw ApiError.unauthorized("Invalid 2FA code. Please try again.");

    // Generate backup codes
    const backupCodes = Array.from({ length: 8 }, () =>
      crypto.randomBytes(4).toString("hex")
    );

    await pool.execute(
      "UPDATE user SET two_factor_enabled = 1, two_factor_backup_codes = ? WHERE id = ?",
      [JSON.stringify(backupCodes), userId]
    );

    return { backupCodes };
  }

  // Validate a TOTP token during login
  async validate2FA(userId: string, token: string): Promise<boolean> {
    const [users]: any = await pool.execute(
      "SELECT two_factor_secret, two_factor_backup_codes FROM user WHERE id = ? AND deleted_at IS NULL",
      [userId]
    );
    const user = users[0];
    if (!user?.two_factor_secret) return false;

    // Check TOTP token first (only if it's 6 digits)
    if (token.length === 6) {
      const result = verifySync({ token, secret: user.two_factor_secret });
      if (result.valid) {
        return true;
      }
    }

    // Check backup codes
    const backupCodes: string[] = typeof user.two_factor_backup_codes === 'string'
      ? JSON.parse(user.two_factor_backup_codes)
      : user.two_factor_backup_codes || [];

    const codeIndex = backupCodes.indexOf(token);
    if (codeIndex !== -1) {
      // Remove used backup code
      backupCodes.splice(codeIndex, 1);
      await pool.execute(
        "UPDATE user SET two_factor_backup_codes = ? WHERE id = ?",
        [JSON.stringify(backupCodes), userId]
      );
      return true;
    }

    return false;
  }

  // Disable 2FA
  async disable2FA(userId: string, password: string) {
    const [users]: any = await pool.execute(
      "SELECT password_hash FROM user WHERE id = ? AND deleted_at IS NULL",
      [userId]
    );
    const user = users[0];
    if (!user) throw ApiError.notFound("User not found");

    const valid = await comparePassword(password, user.password_hash);
    if (!valid) throw ApiError.unauthorized("Invalid password");

    await pool.execute(
      "UPDATE user SET two_factor_enabled = 0, two_factor_secret = NULL, two_factor_backup_codes = NULL WHERE id = ?",
      [userId]
    );
  }

  // Change password (while logged in)
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const [users]: any = await pool.execute(
      "SELECT password_hash FROM user WHERE id = ? AND deleted_at IS NULL",
      [userId]
    );
    const user = users[0];
    if (!user) throw ApiError.notFound("User not found");

    const valid = await comparePassword(currentPassword, user.password_hash);
    if (!valid) throw ApiError.unauthorized("Current password is incorrect");

    const hashedPassword = await hashPassword(newPassword);
    await pool.execute(
      "UPDATE user SET password_hash = ? WHERE id = ?",
      [hashedPassword, userId]
    );
  }
}

export const securityService = new SecurityService();
