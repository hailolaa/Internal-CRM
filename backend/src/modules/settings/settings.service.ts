import pool from "../../config/database.js";
import { ApiError } from "../../utils/ApiError.js";
import { logAuditEvent } from "../../utils/audit.js";
import { UpdateClinicSettingsDTO, SecuritySettingsDTO, UserPreferencesResponse, SecuritySettingsResponse } from "./settings.types.js";



export class SettingsService {
    async getUserPreferences(userId: string): Promise<UserPreferencesResponse>{

        const [rows]: any = await pool.execute(
            "SELECT user_id as userId, theme, language, notifications_enabled as notificationsEnabled, email_notifications as emailNotifications, sms_notifications as smsNotifications FROM user_preference WHERE user_id = ?",
            [userId]
        );

        if(rows.length === 0){
            // create default preferences for the user
            return{
                userId,
                theme: "system",
                language: "en",
                notificationsEnabled: true,
                emailNotifications: true,
                smsNotifications: false
            }
        }

        return rows[0];
    }


    async updatePreferences(userId: string, data: UpdateClinicSettingsDTO): Promise<void>{
        const current = await this.getUserPreferences(userId);

        const theme = data.theme || current.theme;
        const language = data.language || current.language;
        const notificationsEnabled = data.notificationsEnabled !== undefined ? data.notificationsEnabled : current.notificationsEnabled;
        const emailNotifications = data.emailNotifications !== undefined ? data.emailNotifications : current.emailNotifications;
        const smsNotifications = data.smsNotifications !== undefined ? data.smsNotifications : current.smsNotifications;

        await pool.execute(
            `INSERT INTO user_preference (user_id, theme, language, notifications_enabled, email_notifications, sms_notifications)
                VALUES (?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                theme = VALUES(theme),
                language = VALUES(language),
                notifications_enabled = VALUES(notifications_enabled),
                email_notifications = VALUES(email_notifications),
                sms_notifications = VALUES(sms_notifications),
                updated_at = CURRENT_TIMESTAMP`,
            [userId, theme, language, notificationsEnabled, emailNotifications, smsNotifications]
        );
    }


    // Toggle 2FA
    async toggle2FA(userId: string, enabled: boolean): Promise<void>{
        const [result]: any = await pool.execute(
            "UPDATE user SET two_factor_enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            [enabled ? 1 : 0, userId]
        );
        if(result.affectedRows === 0){
            throw ApiError.notFound("User not found");
        }
        const [users]: any = await pool.execute(
            "SELECT clinic_id FROM user WHERE id = ?",
            [userId]
        );
        await logAuditEvent({
            clinicId: users[0]?.clinic_id,
            userId,
            action: enabled ? "TWO_FACTOR_ENABLED" : "TWO_FACTOR_DISABLED",
            entityType: "user",
            entityId: userId,
        });
    }

    async getSecuritySettings(userId: string): Promise<SecuritySettingsResponse>{
        const [rows]: any = await pool.execute(
            "SELECT id as userId, two_factor_enabled as twoFactorEnabled FROM user WHERE id = ?",
            [userId]
        );
        if(rows.length === 0){
            throw ApiError.notFound("User not found");
        }
        return {
            userId: rows[0].userId,
            twoFactorEnabled: !!rows[0].twoFactorEnabled,
            twoFactorVerified: !!rows[0].twoFactorEnabled
        };
    }
}

export const settingsService = new SettingsService();
