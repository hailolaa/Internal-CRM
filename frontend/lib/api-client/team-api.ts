import type {
  BackendAuthResponse,
  InviteTeamMembersPayload,
  StoredAuthSession,
  TeamMember,
} from "@/lib/api-types";
import type { ApiRequest } from "./core";

type TeamApiDeps = {
  apiRequest: ApiRequest;
  toStoredSession: (
    auth: BackendAuthResponse,
    rememberMe?: boolean,
  ) => StoredAuthSession;
  saveAuthSession: (session: StoredAuthSession) => void;
};

export function createTeamApi({
  apiRequest,
  saveAuthSession,
  toStoredSession,
}: TeamApiDeps) {
  return {
    team: {
      async getMembers(token: string) {
        const response = await apiRequest<TeamMember[]>("/api/team/members", {
          token,
        });
        return response.data!;
      },
      async inviteMembers(token: string, payload: InviteTeamMembersPayload) {
        return apiRequest<never>("/api/team/invite", {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        });
      },
      async updateMemberRole(
        token: string,
        userId: string,
        role: InviteTeamMembersPayload["role"],
      ) {
        return apiRequest<never>(`/api/team/members/${userId}/role`, {
          method: "PATCH",
          token,
          body: JSON.stringify({ role }),
        });
      },
      async removeMember(token: string, userId: string) {
        return apiRequest<never>(`/api/team/members/${userId}`, {
          method: "DELETE",
          token,
        });
      },
      async resendInvitation(token: string, invitationId: string) {
        return apiRequest<never>(
          `/api/team/invitations/${invitationId}/resend`,
          {
            method: "POST",
            token,
          },
        );
      },
      async cancelInvitation(token: string, invitationId: string) {
        return apiRequest<never>(`/api/team/invitations/${invitationId}`, {
          method: "DELETE",
          token,
        });
      },
      async acceptInvite(payload: {
        token: string;
        firstName: string;
        lastName: string;
        password: string;
      }) {
        const response = await apiRequest<BackendAuthResponse>(
          "/api/team/invite/accept",
          {
            method: "POST",
            body: JSON.stringify(payload),
          },
        );
        const session = toStoredSession(response.data!, false);
        saveAuthSession(session);
        return session;
      },
    },
  };
}
