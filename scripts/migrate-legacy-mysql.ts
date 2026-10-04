import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parse as parseDotEnv } from "dotenv";
import { createConnection, createPool, type Connection, type RowDataPacket } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";

class MigrationError extends Error {}

function fail(message: string): never {
  throw new MigrationError(message);
}

function readTargetUrl() {
  const fromEnvironment = process.env.TARGET_DATABASE_URL;
  if (fromEnvironment) return fromEnvironment;

  const targetEnvFile = process.env.TARGET_ENV_FILE;
  if (!targetEnvFile) {
    fail("Defina TARGET_DATABASE_URL ou TARGET_ENV_FILE apontando para um arquivo seguro com DATABASE_URL do TiDB.");
  }
  try {
    const contents = readFileSync(path.resolve(targetEnvFile), "utf8");
    const values = parseDotEnv(contents);
    const value = values.TARGET_DATABASE_URL ?? values.DATABASE_URL;
    if (!value) fail("O arquivo indicado por TARGET_ENV_FILE não contém DATABASE_URL nem TARGET_DATABASE_URL.");
    return value;
  } catch (error) {
    if (error instanceof MigrationError) throw error;
    fail("Não foi possível ler TARGET_ENV_FILE; o conteúdo e os segredos foram ocultados.");
  }
}

function readConfiguration() {
  const sourceUrl = process.env.LEGACY_DATABASE_URL || process.env.DATABASE_URL || "";
  if (!sourceUrl) fail("Defina LEGACY_DATABASE_URL ou execute no ambiente que contém DATABASE_URL da origem.");
  const targetUrl = readTargetUrl();
  if (process.env.ALLOW_PUBLIC_SIGNUP === "true") {
    fail("Desative ALLOW_PUBLIC_SIGNUP durante a migração de dados.");
  }

  let sourceAddress: URL;
  let targetAddress: URL;
  try {
    sourceAddress = new URL(sourceUrl);
    targetAddress = new URL(targetUrl);
  } catch {
    fail("Uma URL de banco está malformada; os valores de conexão foram ocultados.");
  }
  if (!["mysql:", "mysql2:"].includes(sourceAddress.protocol) || !["mysql:", "mysql2:"].includes(targetAddress.protocol)) {
    fail("As URLs de origem e destino devem usar o protocolo mysql.");
  }
  if (targetAddress.port !== "4000" || !targetAddress.pathname.replace(/^\/+/, "")) {
    fail("Use a URL do endpoint público TiDB com porta 4000 e um nome de banco.");
  }
  if (sourceAddress.hostname.toLowerCase() === targetAddress.hostname.toLowerCase()
    && sourceAddress.port === targetAddress.port
    && sourceAddress.pathname === targetAddress.pathname) {
    fail("Origem e destino apontam para o mesmo banco; operação cancelada.");
  }
  return { sourceUrl, targetAddress };
}

// Parent tables precede dependent tables. Auth state is intentionally not copied.
const dataTables = [
  "users",
  "subjects",
  "achievement_definitions",
  "activities",
  "activity_completions",
  "study_sessions",
  "user_achievements",
  "quick_notes",
  "weekly_goals",
] as const;
type DataTable = (typeof dataTables)[number];
type CountTable = DataTable | "auth_sessions" | "auth_rate_limits";

function tableName(table: CountTable) {
  return `\`${table}\``;
}

async function countRows(connection: Connection, table: CountTable) {
  const [rows] = await connection.query<RowDataPacket[]>(`SELECT COUNT(*) AS rowCount FROM ${tableName(table)}`);
  return Number(rows[0]?.rowCount ?? 0);
}

async function columns(connection: Connection, table: DataTable) {
  const [rows] = await connection.query<RowDataPacket[]>(`SHOW COLUMNS FROM ${tableName(table)}`);
  return rows.map(row => String(row.Field));
}

async function rowsFor(connection: Connection, table: CountTable) {
  const [rows] = await connection.query<RowDataPacket[]>(`SELECT * FROM ${tableName(table)}`);
  return rows as Array<RowDataPacket & Record<string, unknown>>;
}

function normalizeCatalog(rows: Array<RowDataPacket & Record<string, unknown>>) {
  return rows
    .map(row => ({
      code: String(row.code),
      title: String(row.title),
      description: String(row.description),
      icon: String(row.icon),
      target: Number(row.target),
      category: String(row.category),
    }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function targetConnectionOptions(url: URL) {
  return {
    host: url.hostname,
    port: Number(url.port),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\/+/, "")),
    ssl: { minVersion: "TLSv1.2" as const },
    timezone: "Z" as const,
    connectTimeout: 10_000,
    enableKeepAlive: false,
    keepAliveInitialDelay: 0,
  };
}

async function applyTargetMigrations(targetAddress: URL) {
  const pool = createPool({
    ...targetConnectionOptions(targetAddress),
    waitForConnections: true,
    connectionLimit: 2,
    maxIdle: 1,
    idleTimeout: 60_000,
    queueLimit: 20,
  });
  try {
    await migrate(drizzle(pool), { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
  } finally {
    await pool.end();
  }
}

async function main() {
  const { sourceUrl, targetAddress } = readConfiguration();
  let source: Connection | undefined;
  let target: Connection | undefined;
  let sourceSnapshotStarted = false;
  let targetTransactionStarted = false;

  try {
    // Schema changes are additive and apply only to the destination.
    await applyTargetMigrations(targetAddress);
    source = await createConnection(sourceUrl);
    target = await createConnection(targetConnectionOptions(targetAddress));
    await source.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    await source.query("START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY");
    sourceSnapshotStarted = true;

    const sourceUsers = await rowsFor(source, "users");
    const sourceAdmins = sourceUsers.filter(row => row.role === "admin");
    if (sourceUsers.length !== 1 || sourceAdmins.length !== 1) {
      fail("A origem deve conter exatamente uma conta e ela deve ter papel admin; nenhuma alteração foi feita.");
    }
    const sourceAdmin = sourceAdmins[0];
    if (!isValidEmail(sourceAdmin.email) || typeof sourceAdmin.openId !== "string" || sourceAdmin.openId.length === 0) {
      fail("A conta admin de origem não possui os campos mínimos válidos para o bootstrap.");
    }
    if (sourceAdmin.passwordHash !== null) {
      fail("A conta admin já possui senha local; revise o plano de autenticação antes de importar.");
    }

    const sourceSessions = await countRows(source, "auth_sessions");
    const targetSessions = await countRows(target, "auth_sessions");
    const targetRateLimits = await countRows(target, "auth_rate_limits");
    if (sourceSessions !== 0 || targetSessions !== 0 || targetRateLimits !== 0) {
      fail("Sessões e buckets de autenticação precisam estar vazios; estado temporário não é copiado.");
    }

    const sourceCatalog = normalizeCatalog(await rowsFor(source, "achievement_definitions"));
    const targetCatalog = normalizeCatalog(await rowsFor(target, "achievement_definitions"));
    if (JSON.stringify(sourceCatalog) !== JSON.stringify(targetCatalog)) {
      fail("O catálogo de conquistas dos bancos é diferente; corrija os dados do catálogo antes da importação.");
    }

    const plan: Array<{ table: DataTable; count: number; sourceColumns: string[] }> = [];
    for (const table of dataTables) {
      const sourceCount = await countRows(source, table);
      const targetCount = await countRows(target, table);
      if (table === "achievement_definitions") {
        if (targetCount !== sourceCount) fail("A quantidade de definições de conquista diverge entre origem e destino.");
        plan.push({ table, count: sourceCount, sourceColumns: [] });
        continue;
      }
      if (targetCount !== 0) fail(`O destino já contém registros na tabela ${table}; nenhum dado foi alterado.`);
      const sourceColumns = await columns(source, table);
      const targetColumns = new Set(await columns(target, table));
      const missingColumns = sourceColumns.filter(column => !targetColumns.has(column));
      if (missingColumns.length) fail(`O destino não possui todas as colunas da tabela ${table}; migrations incompletas.`);
      plan.push({ table, count: sourceCount, sourceColumns });
    }

    await target.beginTransaction();
    targetTransactionStarted = true;
    for (const item of plan) {
      if (item.table === "achievement_definitions" || item.count === 0) continue;
      const sourceRows = await rowsFor(source, item.table);
      if (sourceRows.length !== item.count) fail(`A tabela ${item.table} mudou durante a leitura; operação cancelada.`);
      const columnSql = item.sourceColumns.map(column => `\`${column.replaceAll("`", "``")}\``).join(", ");
      for (let offset = 0; offset < sourceRows.length; offset += 100) {
        const chunk = sourceRows.slice(offset, offset + 100);
        const rowPlaceholders = chunk.map(() => `(${item.sourceColumns.map(() => "?").join(", ")})`).join(", ");
        const values = chunk.flatMap(row => item.sourceColumns.map(column => row[column] ?? null));
        await target.execute(`INSERT INTO ${tableName(item.table)} (${columnSql}) VALUES ${rowPlaceholders}`, values);
      }
    }

    const targetUsers = await rowsFor(target, "users");
    const targetAdmins = targetUsers.filter(row => row.role === "admin");
    const targetAdmin = targetAdmins[0];
    if (targetUsers.length !== sourceUsers.length || targetAdmins.length !== 1 || !targetAdmin
      || Number(targetAdmin.id) !== Number(sourceAdmin.id)
      || String(targetAdmin.openId) !== String(sourceAdmin.openId)
      || String(targetAdmin.email).toLowerCase() !== sourceAdmin.email.toLowerCase()
      || targetAdmin.passwordHash !== null) {
      fail("A validação da conta admin importada falhou; nenhum dado será confirmado.");
    }
    if (await countRows(target, "auth_sessions") !== 0 || await countRows(target, "auth_rate_limits") !== 0) {
      fail("Foi encontrado estado de autenticação no destino; nenhum dado será confirmado.");
    }

    for (const item of plan) {
      const importedCount = await countRows(target, item.table);
      if (importedCount !== item.count) fail(`A validação de contagem falhou para ${item.table}.`);
    }

    await target.commit();
    targetTransactionStarted = false;

    console.log("Migração concluída com snapshot consistente; origem somente leitura e estado de autenticação excluído.");
    for (const item of plan) console.log(`${item.table}: ${item.count} registros verificados`);
    console.log("auth_sessions/auth_rate_limits do destino: vazios e verificados");
  } catch (error) {
    if (targetTransactionStarted && target) await target.rollback().catch(() => undefined);
    throw error;
  } finally {
    if (sourceSnapshotStarted && source) await source.rollback().catch(() => undefined);
    await Promise.allSettled([source?.end(), target?.end()].filter((value): value is Promise<void> => Boolean(value)));
  }
}

main().catch(error => {
  if (error instanceof MigrationError) console.error(error.message);
  else {
    const code = typeof error === "object" && error !== null && "code" in error && typeof (error as { code?: unknown }).code === "string"
      ? ` (${(error as { code: string }).code})`
      : "";
    console.error(`Migração cancelada por falha de consulta${code}; detalhes de conexão foram ocultados.`);
  }
  process.exitCode = 1;
});
