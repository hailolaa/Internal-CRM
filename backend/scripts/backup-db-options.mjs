export function readBackupDbConfig(env = process.env) {
  return {
    host: env.DB_HOST || "127.0.0.1",
    port: env.DB_PORT || "3306",
    user: env.DB_USER || "root",
    password: env.DB_PASSWORD || "",
    name: env.DB_NAME || "growth_group_internal_crm",
    ssl: env.DB_SSL === "true",
    sslRejectUnauthorized: env.DB_SSL_REJECT_UNAUTHORIZED !== "false",
  };
}

export function mysqlConnectionOptions(db, database = db.name) {
  return {
    host: db.host,
    port: Number(db.port),
    user: db.user,
    password: db.password,
    ...(database ? { database } : {}),
    ...(db.ssl ? { ssl: { rejectUnauthorized: db.sslRejectUnauthorized } } : {}),
  };
}

export function mysqlCliSslArgs(db) {
  if (!db.ssl) return [];
  return [`--ssl-mode=${db.sslRejectUnauthorized ? "VERIFY_IDENTITY" : "REQUIRED"}`];
}
