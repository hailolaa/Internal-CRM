export interface WorkingHours {
  [day: string]: {
    open: string;
    close: string;
    closed: boolean;
  };
}

// Data required to create a new clinic branch
export interface CreateLocationDTO {
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
  status?: 'active' | 'inactive' | 'coming_soon';
}

// Partial data for updating a location
export interface UpdateLocationDTO extends Partial<CreateLocationDTO> {}

// Complete location details with aggregated stats for the dashboard
export interface LocationResponse {
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
  status: 'active' | 'inactive' | 'coming_soon';
  staffCount: number;
  bookingCount: number;
  rating: number;
}
