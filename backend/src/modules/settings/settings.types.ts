export interface UpdateClinicSettingsDTO {
    theme?: 'light' | 'dark' | 'system';
    language?: string;
    notificationsEnabled?: boolean;
    emailNotifications?: boolean;
    smsNotifications?: boolean; 
}


export interface SecuritySettingsDTO {
    twoFactorEnabled: boolean;
}


export interface UserPreferencesResponse {
    userId: string;
    theme: string;
    language: string;
    notificationsEnabled: boolean;
    emailNotifications: boolean;
    smsNotifications: boolean;
}

export interface SecuritySettingsResponse {
    userId: string;
    twoFactorEnabled: boolean;
    twoFactorVerified: boolean;
}
