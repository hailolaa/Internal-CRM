import pool from "../../config/database.js"
import { ApiError } from "../../utils/ApiError.js";
import { UpdateClinicProfileDTO, UpdatePatientProfileDTO, ClinicProfileResponse, PatientProfileResponse } from "./profiles.types.js";


export class ProfilesService {
    async getClinicProfile(clinicId: string): Promise<ClinicProfileResponse> {
        const [rows]: any = await pool.execute(
            "SELECT id, name, email, website, phone, address, city, state, postal_code as postalCode, country, timezone, subscription_plan as subscriptionPlan FROM clinic WHERE id = ? AND deleted_at IS NULL",
            [clinicId]
        );

        if (rows.length === 0) {
            throw ApiError.notFound("Clinic profile not found");
        }

        return rows[0];
    }

    async updateClinicProfile(clinicId: string, data: UpdateClinicProfileDTO): Promise<void> {
        const fields: string[] = [];
        const values: any[] = [];

        if (data.name) {
            fields.push("name = ?");
            values.push(data.name);
        }

        if (data.email) {
            fields.push("email = ?");
            values.push(data.email);
        }

        if (data.website !== undefined) {
            fields.push("website = ?");
            values.push(data.website || null);
        }

        if (data.phone) {
            fields.push("phone = ?");
            values.push(data.phone);
        }

        if (data.address) {
            fields.push("address = ?");
            values.push(data.address);
        }

        if (data.city) {
            fields.push("city = ?");
            values.push(data.city);
        }

        if (data.state) {
            fields.push("state = ?");
            values.push(data.state);
        }

        if (data.postalCode) {
            fields.push("postal_code = ?");
            values.push(data.postalCode);
        }

        if (data.country) {
            fields.push("country = ?");
            values.push(data.country);
        }

        if (data.timezone) {
            fields.push("timezone = ?");
            values.push(data.timezone);
        }
        


        if (fields.length === 0) {
            return;
        }

        values.push(clinicId);
        await pool.execute(
            `UPDATE clinic SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            values
        );
    }





    async getPatientProfile(contactId: string, clinicId: string): Promise<PatientProfileResponse> {
        const [rows]: any = await pool.execute(
            "SELECT id, email, first_name as firstName, last_name as lastName, phone, date_of_birth as dateOfBirth, gender, address, city, state, postal_code as postalCode, country, status FROM contact WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL",
            [contactId, clinicId]
        );

        if (rows.length === 0) {
            throw ApiError.notFound("Patient profile not found");
        }

        return rows[0];
    }


    async updatePatientProfile(contactId: string, clinicId: string, data: UpdatePatientProfileDTO): Promise<void> {
        const fields: string[] = [];
        const values: any[] = [];

        if (data.firstName) {
            fields.push("first_name = ?");
            values.push(data.firstName);
        }

        if (data.lastName) {
            fields.push("last_name = ?");
            values.push(data.lastName);
        }

        if (data.email) {
            fields.push("email = ?");
            values.push(data.email);
        }

        if (data.phone) {
            fields.push("phone = ?");
            values.push(data.phone);
        }

        if (data.dateOfBirth) {
            fields.push("date_of_birth = ?");
            values.push(data.dateOfBirth);
        }

        if (data.gender) {
            fields.push("gender = ?");
            values.push(data.gender);
        }

        if (data.address) {
            fields.push("address = ?");
            values.push(data.address);
        }

        if (data.city) {
            fields.push("city = ?");
            values.push(data.city);
        }

        if (data.state) {
            fields.push("state = ?");
            values.push(data.state);
        }

        if (data.postalCode) {
            fields.push("postal_code = ?");
            values.push(data.postalCode);
        }

        if (data.country) {
            fields.push("country = ?");
            values.push(data.country);
        }

        if (fields.length === 0) {
            return;
        }

        values.push(contactId, clinicId);

        await pool.execute(
            `UPDATE contact SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND clinic_id = ?`,
            values
        );
    }
}

        
    
export const profilesService = new ProfilesService();
