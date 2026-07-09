import "dotenv/config";
import { existsSync } from "fs";
import { spawn } from "child_process";

const filePath = process.argv[2];

if (!filePath) {
  console.error("Usage: npm run db:restore -- path/to/backup.sql");
  process.exit(1);
}

if (!existsSync(filePath)) {
  console.error(`Backup file not found: ${filePath}`);
  process.exit(1);
}

const mysqlBin = process.env.MYSQL_BIN || "mysql";
const db = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: process.env.DB_PORT || "3306",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  name: process.env.DB_NAME || "growth_group_internal_crm",
};

await run(mysqlBin, [
  `--host=${db.host}`,
  `--port=${db.port}`,
  `--user=${db.user}`,
  "-e",
  `CREATE DATABASE IF NOT EXISTS \`${db.name}\`;`,
]);

await run(mysqlBin, [
  `--host=${db.host}`,
  `--port=${db.port}`,
  `--user=${db.user}`,
  db.name,
], filePath);

console.log(`Restore completed into database: ${db.name}`);

function run(command, args, stdinFile) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: { ...process.env, MYSQL_PWD: db.password },
      stdio: stdinFile ? ["pipe", "inherit", "inherit"] : ["ignore", "inherit", "inherit"],
      shell: process.platform === "win32",
    });

    if (stdinFile) {
      import("fs").then(({ createReadStream }) => {
        createReadStream(stdinFile).pipe(child.stdin);
      }).catch(reject);
    }

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve(undefined);
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}
