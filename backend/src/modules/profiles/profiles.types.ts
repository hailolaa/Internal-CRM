export interface UpdateClinicProfileDTO {
    name?: string;
    email?: string;
    website?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    timezone?: string;
}


export interface UpdatePatientProfileDTO {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    dateOfBirth?: string; //YYYY-MM-DD
    gender?: string;
    address?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
}

export interface ClinicProfileResponse{
    id: string;
    name: string;
    email: string;
    website: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    timezone: string;   
    subscriptionPlan: string;
}

export interface PatientProfileResponse{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    dateOfBirth: string;
    gender: string;
    address: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    status: string;
}
