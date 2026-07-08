export type BackendTeamRole = "ADMIN" | "MANAGER" | "STAFF" | "READ_ONLY";

export interface TeamMember {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: BackendTeamRole | string;
  status: "active" | "pending" | "inactive" | string;
  isInvitation: boolean;
  expiresAt?: string;
  createdAt?: string;
}

export interface InviteTeamMembersPayload {
  emails: string[];
  role: BackendTeamRole;
  personalMessage?: string;
}
