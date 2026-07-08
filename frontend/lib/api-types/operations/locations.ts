export interface WorkingHours {
  [day: string]: {
    open: string;
    close: string;
    closed: boolean;
  };
}

export type BackendLocationStatus = "active" | "inactive" | "coming_soon";

export interface Location {
  id: string;
  clinicId: string;
  name: string;
  address: string;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  workingHours: WorkingHours | null;
  roomCount: number;
  isPrimary: boolean;
  status: BackendLocationStatus;
  staffCount: number;
  bookingCount: number;
  rating: number;
}

export interface CreateLocationPayload {
  name: string;
  address: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  email?: string;
  workingHours?: WorkingHours;
  roomCount?: number;
  isPrimary?: boolean;
  status?: BackendLocationStatus;
}

export type UpdateLocationPayload = Partial<CreateLocationPayload>;
