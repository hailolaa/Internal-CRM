import winston from "winston";
import { config } from "../config/index.js";
import { redactSensitiveValue } from "./redaction.js";

const redactFormat = winston.format((info) => {
  return redactSensitiveValue(info) as any;
});

const logger = winston.createLogger({
  level: config.nodeEnv === "production" ? "info" : "debug",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    redactFormat(),
    winston.format.json()
  ),
  defaultMeta: { service: config.observability.serviceName },
  transports: [
    new winston.transports.Console({
      format: config.nodeEnv === "production"
        ? winston.format.json()
        : winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              const metaStr = Object.keys(meta).length > 2
                ? ` ${JSON.stringify(meta)}`
                : "";
              return `${timestamp} [${level}]: ${message}${metaStr}`;
            })
          ),
    }),
  ],
});

// In production, also log to files
if (config.nodeEnv === "production") {
  logger.add(
    new winston.transports.File({ filename: "logs/error.log", level: "error" })
  );
  logger.add(
    new winston.transports.File({ filename: "logs/combined.log" })
  );
}

export default logger;
