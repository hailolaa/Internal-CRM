import "dotenv/config";
import { readFile } from "node:fs/promises";
import bcrypt from "bcrypt";
import mysql from "mysql2/promise";

const seedSqlPath = process.env.DEMO_SEED_SQL;
const demoPassword = process.env.DEMO_SEED_PASSWORD;

if (!seedSqlPath) {
  console.error("DEMO_SEED_SQL must be set explicitly. Do not load legacy clinic demo data into Mission Control by default.");
  process.exit(1);
}

if (!demoPassword || demoPassword.length < 12) {
  console.error("DEMO_SEED_PASSWORD must be set and at least 12 characters long.");
  process.exit(1);
}

const db = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || "3306"),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  name: process.env.DB_NAME || "growth_group_internal_crm",
  ssl: process.env.DB_SSL === "true",
  sslRejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false",
};

const primaryClinicId = "24bf0195-bb7c-4273-bc35-35f34adcfb0d";
const secondClinicId = "aac89185-939b-5449-bea2-a0a6e902436b";

const demoUsers = [
  {
    id: "f9326ac6-5d15-4b2a-8ec5-dc5c3ff06f35",
    email: "owner@mission-control-demo.example",
    firstName: "Olivia",
    lastName: "Owner",
    phone: "07700 900101",
    role: "SUPER_ADMIN",
    label: "Owner",
    primary: true,
  },
  {
    id: "38ccda5f-a8f4-5a30-8f40-55f3ace8917f",
    email: "manager@mission-control-demo.example",
    firstName: "Maya",
    lastName: "Manager",
    phone: "07700 900102",
    role: "MANAGER",
    label: "Operations Manager",
  },
  {
    id: "c9d7d89d-e71d-52b8-8e85-511f6e8f6a90",
    email: "sales@mission-control-demo.example",
    firstName: "Ria",
    lastName: "Sales",
    phone: "07700 900103",
    role: "RECEPTIONIST",
    label: "Sales Coordinator",
  },
  {
    id: "27f94d7f-bf0f-5084-9e15-5424f2a6728c",
    email: "delivery@mission-control-demo.example",
    firstName: "Priya",
    lastName: "Delivery",
    phone: "07700 900104",
    role: "CLINICIAN",
    label: "Delivery Lead",
  },
  {
    id: "a805af99-922f-575e-8eac-62b5e5f57e93",
    email: "analyst@mission-control-demo.example",
    firstName: "Alex",
    lastName: "Analyst",
    phone: "07700 900105",
    role: "READ_ONLY",
    label: "Agency / Analyst",
  },
];

const connection = await mysql.createConnection({
  host: db.host,
  port: db.port,
  user: db.user,
  password: db.password,
  database: db.name,
  multipleStatements: true,
  ...(db.ssl ? { ssl: { rejectUnauthorized: db.sslRejectUnauthorized } } : {}),
});

try {
  const passwordHash = await bcrypt.hash(demoPassword, 12);

  await connection.beginTransaction();
  await ensureDemoClinics(connection);
  for (const user of demoUsers) {
    await ensureDemoUser(connection, user, passwordHash);
  }
  await connection.commit();

  const seedSql = await readFile(seedSqlPath, "utf8");
  await connection.query(seedSql);

  const evidence = await collectEvidence(connection);
  console.log("Mission Control staging demo seed complete.");
  console.log(`Demo account id: ${primaryClinicId}`);
  console.log("Demo users:");
  for (const user of demoUsers) {
    console.log(`- ${user.label}: ${user.email}`);
  }
  console.log("Evidence:");
  for (const [key, value] of Object.entries(evidence)) {
    console.log(`- ${key}: ${value}`);
  }
} catch (error) {
  try {
    await connection.rollback();
  } catch {
    // Ignore rollback failures after non-transactional seed execution.
  }
  throw error;
} finally {
  await connection.end();
}

async function ensureDemoClinics(connection) {
  await connection.execute(
    `INSERT INTO clinic (
       id, name, email, website, phone, address, city, state, postal_code,
       country, timezone, subscription_plan, subscription_status, max_users
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       email = VALUES(email),
       website = VALUES(website),
       phone = VALUES(phone),
       address = VALUES(address),
       city = VALUES(city),
       state = VALUES(state),
       postal_code = VALUES(postal_code),
       country = VALUES(country),
       timezone = VALUES(timezone),
       subscription_plan = VALUES(subscription_plan),
       subscription_status = VALUES(subscription_status),
       max_users = VALUES(max_users),
       deleted_at = NULL`,
    [
      primaryClinicId,
      "Mission Control Demo Account",
      "hello@mission-control-demo.example",
      "https://mission-control-demo.example",
      "020 7946 1186",
      "42 Operations Way",
      "London",
      "England",
      "W1G 9QH",
      "UK",
      "Europe/London",
      "professional",
      "active",
      20,
    ],
  );

  await connection.execute(
    `INSERT INTO clinic (
       id, name, email, website, phone, address, city, state, postal_code,
       country, timezone, subscription_plan, subscription_status, max_users
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       email = VALUES(email),
       website = VALUES(website),
       phone = VALUES(phone),
       address = VALUES(address),
       city = VALUES(city),
       state = VALUES(state),
       postal_code = VALUES(postal_code),
       country = VALUES(country),
       timezone = VALUES(timezone),
       subscription_plan = VALUES(subscription_plan),
       subscription_status = VALUES(subscription_status),
       max_users = VALUES(max_users),
       deleted_at = NULL`,
    [
      secondClinicId,
      "Growth Group Client Sandbox",
      "hello@growth-client-sandbox.example",
      "https://growth-client-sandbox.example",
      "020 7946 1888",
      "18 Marina Walk",
      "Brighton",
      "England",
      "BN1 1AA",
      "UK",
      "Europe/London",
      "professional",
      "active",
      20,
    ],
  );
}

async function ensureDemoUser(connection, user, passwordHash) {
  await connection.execute(
    `INSERT INTO user (
       id, clinic_id, email, password_hash, first_name, last_name, phone,
       role, email_verified_at, status, is_active
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'active', 1)
     ON DUPLICATE KEY UPDATE
       clinic_id = VALUES(clinic_id),
       password_hash = VALUES(password_hash),
       first_name = VALUES(first_name),
       last_name = VALUES(last_name),
       phone = VALUES(phone),
       role = VALUES(role),
       email_verified_at = COALESCE(email_verified_at, CURRENT_TIMESTAMP),
       status = 'active',
       is_active = 1,
       deleted_at = NULL`,
    [
      user.id,
      primaryClinicId,
      user.email,
      passwordHash,
      user.firstName,
      user.lastName,
      user.phone,
      user.role,
    ],
  );

  await connection.execute(
    `INSERT INTO clinic_membership (user_id, clinic_id, role, status, is_primary)
     VALUES (?, ?, ?, 'active', ?)
     ON DUPLICATE KEY UPDATE
       role = VALUES(role),
       status = 'active',
       is_primary = VALUES(is_primary)`,
    [user.id, primaryClinicId, user.role, user.primary ? 1 : 0],
  );

  if (user.primary) {
    await connection.execute(
      `INSERT INTO clinic_membership (user_id, clinic_id, role, status, is_primary)
       VALUES (?, ?, 'SUPER_ADMIN', 'active', 0)
       ON DUPLICATE KEY UPDATE role = 'SUPER_ADMIN', status = 'active', is_primary = 0`,
      [user.id, secondClinicId],
    );
  }
}

async function collectEvidence(connection) {
  const checks = {
    users: "SELECT COUNT(*) AS count FROM user WHERE email LIKE '%@mission-control-demo.example' AND deleted_at IS NULL",
    memberships: "SELECT COUNT(*) AS count FROM clinic_membership WHERE clinic_id = ? AND status = 'active'",
    onboarding: "SELECT COUNT(*) AS count FROM onboarding_state WHERE clinic_id = ? AND completed_at IS NOT NULL",
    contacts: "SELECT COUNT(*) AS count FROM contact WHERE clinic_id = ? AND deleted_at IS NULL",
    calls: "SELECT COUNT(*) AS count FROM `\u00a0call\u00a0` WHERE clinic_id = ? AND deleted_at IS NULL",
    consults: "SELECT COUNT(*) AS count FROM manual_consult_entry WHERE clinic_id = ? AND deleted_at IS NULL",
    spendRows: "SELECT COUNT(*) AS count FROM manual_spend_entry WHERE clinic_id = ? AND deleted_at IS NULL",
    benchmarks: "SELECT COUNT(*) AS count FROM report WHERE clinic_id = ? AND deleted_at IS NULL",
    reputationRequests: "SELECT COUNT(*) AS count FROM review_request WHERE clinic_id = ? AND deleted_at IS NULL",
    gbpChecklist: "SELECT COUNT(*) AS count FROM gbp_checklist_item WHERE clinic_id = ?",
    pipelineStages: "SELECT COUNT(*) AS count FROM pipeline_stage WHERE clinic_id = ? AND deleted_at IS NULL",
  };

  const evidence = {};
  for (const [key, sql] of Object.entries(checks)) {
    const params = key === "users" ? [] : [primaryClinicId];
    const [rows] = await connection.execute(sql, params);
    evidence[key] = Number(rows[0]?.count || 0);
  }
  return evidence;
}
