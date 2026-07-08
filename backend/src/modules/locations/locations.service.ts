import pool from "../../config/database.js";
import { v4 as uuidv4 } from "uuid";
import { ApiError } from "../../utils/ApiError.js";
import { CreateLocationDTO, UpdateLocationDTO, LocationResponse } from "./locations.type.js";

export class LocationsService {

  // Create a new clinic location
  async createLocation(clinicId: string, data: CreateLocationDTO): Promise<string> {
    const id = uuidv4();
    const {
      name, address, city, state, postalCode, country, 
      phone, email, workingHours, roomCount, isPrimary, status 
    } = data;

    await pool.execute(
      `INSERT INTO clinic_location (
        id, clinic_id, name, address, city, state, postal_code, country, 
        phone, email, working_hours, room_count, is_primary, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, clinicId, name, address, city || null, state || null, postalCode || null, country || null,
        phone || null, email || null, workingHours ? JSON.stringify(workingHours) : null, 
        roomCount || 0, isPrimary ? 1 : 0, status || 'active'
      ]
    );

    return id;
  }

  // Get all locations for a clinic with staff and booking counts
  async getLocations(clinicId: string): Promise<LocationResponse[]> {
    const [rows]: any = await pool.execute(
      `SELECT 
        l.*,
        l.postal_code as postalCode,
        l.working_hours as workingHours,
        l.room_count as roomCount,
        l.is_primary as isPrimary,
        (SELECT COUNT(*) FROM user_location ul WHERE ul.location_id = l.id) as staffCount,
        0 as bookingCount, -- Placeholder until appointments module is ready
        4.8 as rating      -- Placeholder for demonstration
      FROM clinic_location l
      WHERE l.clinic_id = ? AND l.deleted_at IS NULL
      ORDER BY l.is_primary DESC, l.name ASC`,
      [clinicId]
    );

    return rows.map((row: any) => ({
      ...row,
      isPrimary: !!row.isPrimary,
      workingHours: typeof row.workingHours === 'string' ? JSON.parse(row.workingHours) : row.workingHours
    }));
  }

  // Update location details
  async updateLocation(clinicId: string, locationId: string, data: UpdateLocationDTO): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    // Map DTO to DB columns
    const mapping: any = {
      name: 'name', address: 'address', city: 'city', state: 'state', 
      postalCode: 'postal_code', country: 'country', phone: 'phone', 
      email: 'email', roomCount: 'room_count', isPrimary: 'is_primary', status: 'status'
    };

    Object.entries(data).forEach(([key, value]) => {
      if (mapping[key] !== undefined) {
        fields.push(`${mapping[key]} = ?`);
        values.push(key === 'isPrimary' ? (value ? 1 : 0) : value);
      } else if (key === 'workingHours') {
        fields.push('working_hours = ?');
        values.push(JSON.stringify(value));
      }
    });

    if (fields.length === 0) return;

    values.push(locationId, clinicId);
    const [result]: any = await pool.execute(
      `UPDATE clinic_location SET ${fields.join(', ')} WHERE id = ? AND clinic_id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      throw ApiError.notFound("Location not found");
    }
  }

  // Delete a location (Soft delete)
  async deleteLocation(clinicId: string, locationId: string): Promise<void> {
    const [result]: any = await pool.execute(
      "UPDATE clinic_location SET deleted_at = CURRENT_TIMESTAMP, status = 'inactive' WHERE id = ? AND clinic_id = ?",
      [locationId, clinicId]
    );

    if (result.affectedRows === 0) {
      throw ApiError.notFound("Location not found");
    }
  }
}

export const locationsService = new LocationsService();
