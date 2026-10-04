import { and, eq, gt, isNull, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";
import { authRateLimits, authSessions, users } from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

function createDatabasePool(connectionString: string) {
  const url = new URL(connectionString);
  if (url.protocol !== "mysql:" && url.protocol !== "mysql2:") {
    throw new Error("DATABASE_URL must use the mysql protocol");
  }
  const requestedLimit = Number(process.env.DB_CONNECTION_LIMIT ?? "1");
  const connectionLimit = Number.isInteger(requestedLimit) && requestedLimit >= 1 && requestedLimit <= 4
    ? requestedLimit
    : 1;

  return createPool({
    host: url.hostname,
    port: Number(url.port || "3306"),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")),
    ssl: process.env.DATABASE_TLS === "true" ? { minVersion: "TLSv1.2" } : undefined,
    waitForConnections: true,
    connectionLimit,
    maxIdle: connectionLimit,
    idleTimeout: 60_000,
    queueLimit: 20,
    connectTimeout: 10_000,
    enableKeepAlive: false,
    keepAliveInitialDelay: 0,
    timezone: "Z",
  });
}

/** Lazily create the Drizzle instance so static tooling does not require a database. */
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      // mysql2/promise's Pool declaration and drizzle's Pool declaration differ slightly.
      _db = drizzle(createDatabasePool(process.env.DATABASE_URL)) as unknown as ReturnType<typeof drizzle>;
    } catch {
      console.warn("[Database] Failed to initialize the MySQL/TiDB pool.");
      _db = null;
    }
  }
  return _db;
}

export async function checkDatabaseConnection() {
  const db = await getDb();
  if (!db) return false;
  try {
    await db.execute(sql`SELECT 1`);
    return true;
  } catch {
    return false;
  }
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.select().from(users).where(sql`LOWER(${users.email}) = ${email}`).limit(1);
  return result[0];
}

export async function getUserByAccountId(accountId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.select().from(users).where(eq(users.accountId, accountId)).limit(1);
  return result[0];
}

export async function createLocalUser(input: {
  accountId: string;
  name: string;
  email: string;
  passwordHash: string;
  role: "admin" | "user";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const now = new Date();
  const result = await db.insert(users).values({
    ...input,
    loginMethod: "password",
    lastSignedIn: now,
  });
  const id = Number(result[0].insertId);
  return getUserById(id);
}

export async function setPasswordForExistingUser(input: {
  id: number;
  passwordHash: string;
  name: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.update(users).set({
    passwordHash: input.passwordHash,
    name: input.name,
    loginMethod: "password",
    lastSignedIn: new Date(),
  }).where(and(eq(users.id, input.id), isNull(users.passwordHash)));
  const affectedRows = Number((result[0] as { affectedRows?: number }).affectedRows ?? 0);
  return affectedRows === 1 ? getUserById(input.id) : undefined;
}

export async function setLastSignedIn(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, id));
}

export async function createAuthSession(input: {
  userId: number;
  tokenHash: string;
  expiresAt: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(authSessions).values(input);
}

export async function getUserBySessionHash(tokenHash: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select({ user: users })
    .from(authSessions)
    .innerJoin(users, eq(authSessions.userId, users.id))
    .where(and(eq(authSessions.tokenHash, tokenHash), gt(authSessions.expiresAt, new Date())))
    .limit(1);
  return result[0]?.user;
}

export async function revokeAuthSession(tokenHash: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(authSessions).where(eq(authSessions.tokenHash, tokenHash));
}

export async function deleteExpiredAuthSessions(now = new Date()) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(authSessions).where(lte(authSessions.expiresAt, now));
}

/** Atomically increments a hashed bucket shared by every application instance. */
export async function consumeAuthRateLimit(bucketHash: string, maxAttempts: number, windowMs: number) {
  const db = await getDb();
  if (!db) return false;
  const now = new Date();
  const cutoff = new Date(now.getTime() - windowMs);
  await db.insert(authRateLimits).values({ bucketHash, windowStartedAt: now, attempts: 1 })
    .onDuplicateKeyUpdate({ set: {
      attempts: sql`CASE WHEN ${authRateLimits.windowStartedAt} <= ${cutoff} THEN 1 ELSE ${authRateLimits.attempts} + 1 END`,
      windowStartedAt: sql`CASE WHEN ${authRateLimits.windowStartedAt} <= ${cutoff} THEN ${now} ELSE ${authRateLimits.windowStartedAt} END`,
    } });
  const state = await db.select({ attempts: authRateLimits.attempts })
    .from(authRateLimits)
    .where(eq(authRateLimits.bucketHash, bucketHash))
    .limit(1);
  return (state[0]?.attempts ?? maxAttempts + 1) <= maxAttempts;
}

export async function deleteExpiredAuthRateLimits(cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) {
  const db = await getDb();
  if (!db) return;
  await db.delete(authRateLimits).where(lte(authRateLimits.windowStartedAt, cutoff));
}
