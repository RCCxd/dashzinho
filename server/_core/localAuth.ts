import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { parse } from "cookie";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { COOKIE_NAME, SESSION_DURATION_MS } from "@shared/const";

const SCRYPT_OPTIONS = { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const PASSWORD_BYTES = 64;
let nextCleanupAt = 0;

async function cleanupAuthStateIfDue() {
  if (Date.now() < nextCleanupAt) return;
  nextCleanupAt = Date.now() + 6 * 60 * 60 * 1000;
  try {
    await Promise.all([db.deleteExpiredAuthSessions(), db.deleteExpiredAuthRateLimits()]);
  } catch {
    nextCleanupAt = 0;
  }
}

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, PASSWORD_BYTES, SCRYPT_OPTIONS, (error, key) => {
      if (error) reject(error);
      else resolve(key as Buffer);
    });
  });
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, encoded: string | null | undefined) {
  if (!encoded) return false;
  const [algorithm, saltHex, keyHex] = encoded.split("$");
  if (algorithm !== "scrypt" || !saltHex || !keyHex || !/^[0-9a-f]{32}$/i.test(saltHex) || !/^[0-9a-f]{128}$/i.test(keyHex)) return false;
  const expected = Buffer.from(keyHex, "hex");
  const actual = await deriveKey(password, Buffer.from(saltHex, "hex"));
  return timingSafeEqual(actual, expected);
}

export async function verifyPasswordForLogin(password: string, encoded: string | null | undefined) {
  if (!encoded) {
    await hashPassword(password);
    return false;
  }
  return verifyPassword(password, encoded);
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function getSessionToken(req: Request) {
  const token = parse(req.headers.cookie ?? "")[COOKIE_NAME];
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : undefined;
}

async function consumeAuthAttempt(key: string, maxAttempts: number, windowMs: number) {
  const bucketHash = createHash("sha256").update(`dashboard2b:auth-rate:${key}`).digest("hex");
  const allowed = await db.consumeAuthRateLimit(bucketHash, maxAttempts, windowMs);
  await cleanupAuthStateIfDue();
  return allowed;
}

export async function allowAuthAttempt(req: Request, bucket: string, maxAttempts: number, windowMs: number) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  return consumeAuthAttempt(`ip:${ip}:${bucket}`, maxAttempts, windowMs);
}

export async function allowAuthAttemptGlobal(bucket: string, maxAttempts: number, windowMs: number) {
  return consumeAuthAttempt(`global:${bucket}`, maxAttempts, windowMs);
}

export function accountIdForEmail(email: string) {
  return createHash("sha256").update(`dashboard2b:${normalizeEmail(email)}`).digest("hex");
}

export function isPublicSignupEnabled() {
  return process.env.ALLOW_PUBLIC_SIGNUP === "true";
}

export function isAdminBootstrapConfigured() {
  return (process.env.ADMIN_BOOTSTRAP_CODE?.length ?? 0) >= 32;
}

export function verifyAdminBootstrapCode(supplied: string | undefined) {
  const expected = process.env.ADMIN_BOOTSTRAP_CODE ?? "";
  if (!supplied || expected.length < 32) return false;
  const expectedDigest = createHash("sha256").update(expected).digest();
  const suppliedDigest = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(expectedDigest, suppliedDigest);
}

export function toPublicUser(user: User | null | undefined) {
  if (!user) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export async function authenticateRequest(req: Request) {
  const token = getSessionToken(req);
  if (!token) return null;
  return (await db.getUserBySessionHash(hashSessionToken(token))) ?? null;
}

export async function establishSession(user: User, req: Request, res: Response) {
  await cleanupAuthStateIfDue();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await db.createAuthSession({ userId: user.id, tokenHash: hashSessionToken(token), expiresAt });
  res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(req), expires: expiresAt, maxAge: SESSION_DURATION_MS });
}

export async function revokeCurrentSession(req: Request, res: Response) {
  const token = getSessionToken(req);
  if (token) await db.revokeAuthSession(hashSessionToken(token));
  res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(req), maxAge: 0 });
}
