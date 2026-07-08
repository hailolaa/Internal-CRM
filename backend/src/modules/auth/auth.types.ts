export interface RegisterClinicDTO{
    clinicName: string;
    adminEmail: string;
    adminPassword: string;
    firstName: string;
    lastName: string;
    phone?: string;
}

export interface RegisterPatientDTO{
    clinicId: string;
    email: string;
    password?: string; //optional if created by staff, but required for self-registration
    firstName: string;
    lastName: string;
    phone?: string;   
}

export interface LoginDTO{
    email: string;
    password?: string;
    rememberMe?: boolean;
}

export interface Verify2faDTO {
    email: string;
    code: string;
    rememberMe?: boolean;
}

export interface ForgotPasswordDTO{
    email: string;
}

export interface ResetPasswordDTO{
    email: string;
    token: string;
    newPassword: string;
}

export interface VerifyEmailDTO {
    email: string;
    token: string;
}

export interface ResendVerificationEmailDTO {
    email: string;
}


export type OAuthProvider = 'google' | 'facebook' | 'apple';

export interface OAuthLoginDTO {
    provider: OAuthProvider;
    providerUserId: string;
    email: string;
    firstName?: string;
    lastName?: string;
    clinicId?: string;
}

export interface OAuthStatePayload {
    provider: OAuthProvider;
    mode: 'login' | 'signup';
    rememberMe: boolean;
}

export interface OAuthCallbackResult extends AuthResponse {
    isNewUser: boolean;
    rememberMe: boolean;
}

export interface AuthResponse {
    user: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        role: string;
        clinicId: string;
        clinicName?: string | null;
        emailVerifiedAt?: string | null;
    };
    clinics?: ClinicMembershipResponse[];
    tokens:{
        token: string;
        refreshToken?: string;
        expiresIn?: string;
        requires2FA?: boolean;
    }
}

export interface RefreshTokenDTO {
    refreshToken: string;
}

export interface LogoutDTO {
    refreshToken?: string;
}

export interface SwitchClinicDTO {
    clinicId: string;
    refreshToken?: string;
    rememberMe?: boolean;
}

export interface ClinicMembershipResponse {
    id: string;
    name: string;
    plan: string | null;
    status: string;
    role: string;
    location: string | null;
    isPrimary: boolean;
}

export interface AuthRequestMeta {
    ipAddress?: string | null;
    userAgent?: string | null;
}

export interface SessionResponse {
    id: string;
    createdAt: string;
    expiresAt: string;
    usedAt: string | null;
    revoked: boolean;
    ipAddress: string | null;
    userAgent: string | null;
    current: boolean;
}

export interface SecurityEventResponse {
    id: string;
    action: string;
    entityType: string | null;
    entityId: string | null;
    changes: Record<string, unknown> | null;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: string;
}
