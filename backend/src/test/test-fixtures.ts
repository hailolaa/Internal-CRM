import { v4 as uuidv4 } from "uuid";
import pool from "../config/database.js";
import { generateToken, hashPassword } from "../utils/helpers.js";

export async function createTestClinicAndAdmin(prefix: string) {
  const clinicId = uuidv4();
  const userId = uuidv4();
  const email = `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}@test.com`;
  const passwordHash = await hashPassword("password123");

  await pool.execute(
    `INSERT INTO clinic
      (id, name, email, phone, timezone, subscription_plan, subscription_status, max_users)
     VALUES (?, ?, ?, '555-0100', 'Europe/London', 'professional', 'active', 20)`,
    [clinicId, `${prefix} Clinic`, email],
  );
  await pool.execute(
    `INSERT INTO user
      (id, clinic_id, email, password_hash, first_name, last_name, role, email_verified_at, status, is_active)
     VALUES (?, ?, ?, ?, ?, 'Admin', 'SUPER_ADMIN', CURRENT_TIMESTAMP, 'active', 1)`,
    [userId, clinicId, email, passwordHash, prefix],
  );
  await pool.execute(
    `INSERT INTO clinic_membership (user_id, clinic_id, role, status, is_primary)
     VALUES (?, ?, 'SUPER_ADMIN', 'active', 1)`,
    [userId, clinicId],
  );

  return {
    clinicId,
    userId,
    token: generateToken({ userId, clinicId, role: "SUPER_ADMIN", email }),
  };
}
