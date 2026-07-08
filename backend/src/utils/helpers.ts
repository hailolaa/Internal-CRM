import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { config } from "../config/index.js";

const SALT_ROUNDS = 12;


export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}


export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(payload: {
  userId: string;
  clinicId: string;
  role: string;
  email: string;
}, expiresIn = config.jwt.expiresIn): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: expiresIn as any,
  });
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString("base64url");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}


export function verifyToken(token: string): jwt.JwtPayload {
  return jwt.verify(token, config.jwt.secret) as jwt.JwtPayload;
}


export function generateOTP(): string {
  return crypto.randomInt(100000, 999999).toString();
}


export function generateResetToken(): string {
  return crypto.randomBytes(32).toString("hex");
}
