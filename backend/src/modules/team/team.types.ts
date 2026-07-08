export interface InviteMembersDTO {
    emails: string[];
    role: 'ADMIN' | 'MANAGER' | 'STAFF' | 'READ_ONLY';
    personalMessage?: string;
}

export interface AcceptInvitationDTO {
    token: string;
    firstName: string;
    lastName: string;
    password: string;
}

export interface UpdateMemberRoleDTO {
    role: 'ADMIN' | 'MANAGER' | 'STAFF' | 'READ_ONLY';
}


export interface TeamMemberResponse {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    role: string;
    status: 'active' | 'pending' | 'inactive';
    isInvitation: boolean;
}
