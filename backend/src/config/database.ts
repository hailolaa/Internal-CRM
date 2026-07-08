import mysql from "mysql2/promise";
import { config } from "./index.js";

const pool = mysql.createPool({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.name,
    ...(config.db.ssl
        ? { ssl: { rejectUnauthorized: config.db.sslRejectUnauthorized } }
        : {}),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    timezone: "Z",
});

export async function testConnection(): Promise<void> {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
}

export async function getDatabaseHealth() {
    const start = Date.now();
    const connection = await pool.getConnection();
    try {
        await connection.query("SELECT 1");
        return {
            ok: true,
            latencyMs: Date.now() - start,
        };
    } finally {
        connection.release();
    }
}

export default pool;
