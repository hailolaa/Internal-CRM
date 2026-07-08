import pool from "../../config/database.js";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import { config } from "../../config/index.js";
import { emailService } from "../../services/email.service.js";
import { ApiError } from "../../utils/ApiError.js";
import { generateRefreshToken, generateToken, hashPassword, hashToken } from "../../utils/helpers.js";
import logger from "../../utils/logger.js";
import { logAuditEvent } from "../../utils/audit.js";
import { AcceptInvitationDTO, InviteMembersDTO, TeamMemberResponse } from "./team.types.js";
import {
    logInvitationCreated,
    logTeamMemberRemoved,
    logTeamMemberRoleUpdated,
} from "./team.audit.js";

interface RequestMeta {
    ipAddress?: string | null;
    userAgent?: string | null;
}


export class TeamService{
    // Invite multiple members to a clinic
    async inviteMembers(
        clinicId: string,
        invitedBy: string,
        data: InviteMembersDTO,
        meta: RequestMeta = {},
    ): Promise<void> {
        const { emails, role, personalMessage } = data;
        const expiresAt = new Date();


        expiresAt.setHours(expiresAt.getHours() + 48);

        const [clinics]: any = await pool.execute(
            "SELECT name FROM clinic WHERE id = ?",
            [clinicId]
        );
        const clinicName = clinics[0]?.name || "Clinic Grower";

        for(const email of emails) {
            const [existing]: any = await pool.execute(
                "SELECT id FROM user WHERE email = ? AND clinic_id = ? ",
                [email, clinicId]
            );

            if(existing.length > 0) {
                console.warn(`Skipping user ${email} - already a team member`);
                continue;
            }
            
            
            // Generate secure invitation token

            const rawToken = crypto.randomBytes(32).toString('hex');
            const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');


            const invitationId = uuidv4();
            await pool.execute(
                `INSERT INTO invitation (id, clinic_id, email, role, token_hash, invited_by, expires_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [invitationId, clinicId, email, role, tokenHash, invitedBy, expiresAt]
            );

            const inviteUrl = `${config.frontendUrl.replace(/\/$/, "")}/signup?inviteToken=${encodeURIComponent(rawToken)}`;

            const emailInput = {
                    email,
                    role,
                    inviteUrl,
                    clinicName,
                    ...(personalMessage ? { personalMessage } : {}),
                };

            try {
                await emailService.sendTeamInviteEmail(emailInput);
            } catch (error) {
                logger.error("Failed to send team invitation email", {
                    email,
                    clinicId,
                    error: error instanceof Error ? error.message : String(error),
                });
                throw error;
            }

            await logInvitationCreated({
                clinicId,
                email,
                invitationId,
                role,
                userId: invitedBy,
                meta,
            });

            
        }
    }

    // Resend a pending invitation with a fresh token and expiry window
    async resendInvitation(
        clinicId: string,
        invitedBy: string,
        invitationId: string,
    ): Promise<void> {
        const [invites]: any = await pool.execute(
            `SELECT i.id, i.email, i.role, c.name as clinicName
             FROM invitation i
             JOIN clinic c ON c.id = i.clinic_id
             WHERE i.id = ?
               AND i.clinic_id = ?
               AND i.status = 'pending'
               AND i.expires_at > CURRENT_TIMESTAMP
             LIMIT 1`,
            [invitationId, clinicId],
        );
        const invite = invites[0];
        if (!invite) {
            throw ApiError.notFound("Pending invitation not found");
        }

        const rawToken = crypto.randomBytes(32).toString("hex");
        const tokenHash = hashToken(rawToken);
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 48);

        await pool.execute(
            "UPDATE invitation SET token_hash = ?, expires_at = ? WHERE id = ? AND clinic_id = ?",
            [tokenHash, expiresAt, invitationId, clinicId],
        );

        const inviteUrl = `${config.frontendUrl.replace(/\/$/, "")}/signup?inviteToken=${encodeURIComponent(rawToken)}`;
        await emailService.sendTeamInviteEmail({
            email: invite.email,
            role: invite.role,
            inviteUrl,
            clinicName: invite.clinicName || "Clinic Grower",
        });

        await logAuditEvent({
            clinicId,
            userId: invitedBy,
            action: "INVITATION_RESENT",
            entityType: "invitation",
            entityId: invitationId,
            changes: { email: invite.email, role: invite.role },
        });
    }

    // Cancel a pending invitation without deleting its audit trail
    async cancelInvitation(
        clinicId: string,
        userId: string,
        invitationId: string,
    ): Promise<void> {
        const [result]: any = await pool.execute(
            "UPDATE invitation SET status = 'expired' WHERE id = ? AND clinic_id = ? AND status = 'pending'",
            [invitationId, clinicId],
        );

        if (result.affectedRows === 0) {
            throw ApiError.notFound("Pending invitation not found");
        }

        await logAuditEvent({
            clinicId,
            userId,
            action: "INVITATION_CANCELLED",
            entityType: "invitation",
            entityId: invitationId,
        });
    }

    async acceptInvitation(
        data: AcceptInvitationDTO,
        meta: RequestMeta = {},
    ) {
        const tokenHash = hashToken(data.token);
        const [invites]: any = await pool.execute(
            `SELECT id, clinic_id as clinicId, email, role
             FROM invitation
             WHERE token_hash = ?
               AND status = 'pending'
               AND expires_at > CURRENT_TIMESTAMP
             LIMIT 1`,
            [tokenHash],
        );
        const invitation = invites[0];
        if (!invitation) {
            throw ApiError.badRequest("Invitation link is invalid or expired");
        }

        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            const [existingUsers]: any = await connection.execute(
                "SELECT id FROM user WHERE email = ? AND deleted_at IS NULL",
                [invitation.email],
            );
            if (existingUsers.length > 0) {
                throw ApiError.conflict("An account already exists for this email");
            }

            const userId = uuidv4();
            const passwordHash = await hashPassword(data.password);
            await connection.execute(
                `INSERT INTO user
                    (id, clinic_id, email, password_hash, first_name, last_name, role, email_verified_at, status, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'active', 1)`,
                [
                    userId,
                    invitation.clinicId,
                    invitation.email,
                    passwordHash,
                    data.firstName,
                    data.lastName,
                    invitation.role,
                ],
            );

            await connection.execute(
                `INSERT INTO clinic_membership (user_id, clinic_id, role, status, is_primary)
                 VALUES (?, ?, ?, 'active', 1)
                 ON DUPLICATE KEY UPDATE role = VALUES(role), status = 'active'`,
                [userId, invitation.clinicId, invitation.role],
            );

            await connection.execute(
                "UPDATE invitation SET status = 'accepted' WHERE id = ?",
                [invitation.id],
            );

            const refreshToken = generateRefreshToken();
            const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            await connection.execute(
                `INSERT INTO tokens
                    (id, user_id, token_hash, token_type, expires_at, ip_address, user_agent)
                 VALUES (?, ?, ?, 'refresh', ?, ?, ?)`,
                [
                    uuidv4(),
                    userId,
                    hashToken(refreshToken),
                    refreshExpiresAt,
                    meta.ipAddress || null,
                    meta.userAgent?.slice(0, 255) || null,
                ],
            );

            await connection.commit();

            const accessToken = generateToken(
                {
                    userId,
                    clinicId: invitation.clinicId,
                    role: invitation.role,
                    email: invitation.email,
                },
                "15m",
            );

            await logAuditEvent({
                clinicId: invitation.clinicId,
                userId,
                action: "INVITATION_ACCEPTED",
                entityType: "invitation",
                entityId: invitation.id,
                changes: {
                    email: invitation.email,
                    role: invitation.role,
                },
                ipAddress: meta.ipAddress,
                userAgent: meta.userAgent,
            });

            return {
                user: {
                    id: userId,
                    email: invitation.email,
                    firstName: data.firstName,
                    lastName: data.lastName,
                    role: invitation.role,
                    clinicId: invitation.clinicId,
                    emailVerifiedAt: new Date().toISOString(),
                },
                tokens: {
                    token: accessToken,
                    refreshToken,
                    expiresIn: "15m",
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


    // Get all active users and pending invitations for the list view
    async getTeamMembers(clinicId: string):Promise<TeamMemberResponse[]> {
        // Fetch active users
        const [users]: any = await pool.execute(
            "SELECT id, email, first_name as firstName, last_name as lastName, role, status FROM user WHERE clinic_id = ? AND deleted_at IS NULL",
            [clinicId]
        );

        const activeMemmbers = users.map((u: any) => ({
            ...u,
            isInvitation: false,
            }));

        // Fetch pending invitations
        const [invites]: any = await pool.execute(
            "SELECT id, email, role, status, expires_at as expiresAt, created_at as createdAt FROM invitation WHERE clinic_id = ? AND status = 'pending' AND expires_at > NOW()",
            [clinicId]
        );

        const pendingMembers = invites.map((i: any) => ({
            ...i,
            firstName: "pending",
            lastName: "Invite",
            isInvitation: true,
        }));

        return [...activeMemmbers, ...pendingMembers];

    }


    // Remove a member without allowing a stale token to delete across clinics
    async removeMember(
        clinicId: string,
        actorUserId: string,
        userId: string,
        meta: RequestMeta = {},
    ): Promise<void> {
        if (actorUserId === userId) {
            throw ApiError.badRequest("You cannot remove your own account");
        }

        const [members]: any = await pool.execute(
            `SELECT email, role
             FROM user
             WHERE id = ?
               AND clinic_id = ?
               AND deleted_at IS NULL
             LIMIT 1`,
            [userId, clinicId],
        );
        const member = members[0];
        if (!member) {
            throw ApiError.notFound("Team member not found or already removed");
        }

        const [result]: any = await pool.execute(
            "UPDATE user SET deleted_at = CURRENT_TIMESTAMP, status = 'inactive' WHERE id = ? AND clinic_id = ?",
            [userId, clinicId]
        );
        
        if (result.affectedRows === 0) {
            throw ApiError.notFound("Team member not found or already removed");
        }

        await logTeamMemberRemoved({
            clinicId,
            member,
            memberId: userId,
            userId: actorUserId,
            meta,
        });
    }

    // Update roles inside the clinic and record the previous role for audit review
    async updateMemberRole(
        clinicId: string,
        actorUserId: string,
        userId: string,
        role: string,
        meta: RequestMeta = {},
    ): Promise<void> {
        if (actorUserId === userId) {
            throw ApiError.badRequest("You cannot update your own role");
        }

        const [members]: any = await pool.execute(
            `SELECT email, role
             FROM user
             WHERE id = ?
               AND clinic_id = ?
               AND deleted_at IS NULL
             LIMIT 1`,
            [userId, clinicId],
        );
        const member = members[0];
        if (!member) {
            throw ApiError.notFound("Team member not found");
        }

        const [result]: any = await pool.execute("UPDATE user SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND clinic_id = ?",
            [role, userId, clinicId]
        );
        if(result.affectedRows === 0) {
            throw ApiError.notFound("Team member not found");
        }

        await logTeamMemberRoleUpdated({
            clinicId,
            member,
            memberId: userId,
            newRole: role,
            userId: actorUserId,
            meta,
        });
    }
}

export const teamService = new TeamService();
