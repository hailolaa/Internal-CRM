import { logAuditEvent } from "../../utils/audit.js";

export interface TeamAuditMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function logInvitationCreated({
  clinicId,
  email,
  invitationId,
  role,
  userId,
  meta = {},
}: {
  clinicId: string;
  email: string;
  invitationId: string;
  role: string;
  userId: string;
  meta?: TeamAuditMeta;
}) {
  await logAuditEvent({
    clinicId,
    userId,
    action: "INVITATION_CREATED",
    entityType: "invitation",
    entityId: invitationId,
    changes: { email, role },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
}

export async function logTeamMemberRemoved({
  clinicId,
  memberId,
  member,
  userId,
  meta = {},
}: {
  clinicId: string;
  memberId: string;
  member: { email: string; role: string };
  userId: string;
  meta?: TeamAuditMeta;
}) {
  await logAuditEvent({
    clinicId,
    userId,
    action: "TEAM_MEMBER_REMOVED",
    entityType: "user",
    entityId: memberId,
    changes: { email: member.email, role: member.role },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
}

export async function logTeamMemberRoleUpdated({
  clinicId,
  memberId,
  member,
  newRole,
  userId,
  meta = {},
}: {
  clinicId: string;
  memberId: string;
  member: { email: string; role: string };
  newRole: string;
  userId: string;
  meta?: TeamAuditMeta;
}) {
  await logAuditEvent({
    clinicId,
    userId,
    action: "TEAM_MEMBER_ROLE_UPDATED",
    entityType: "user",
    entityId: memberId,
    changes: {
      email: member.email,
      previousRole: member.role,
      newRole,
    },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
}
