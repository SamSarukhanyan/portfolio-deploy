import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import { HttpError } from "./http.js";
import { API_DIR } from "./paths.js";

let pool: mysql.Pool | null = null;
let lastError: string | null = "not connected yet";

export async function initDb(): Promise<void> {
  // re-read .env on every attempt, so a password written by setup-db.sh is picked up without a restart
  dotenv.config({ path: path.join(API_DIR, ".env"), override: true, quiet: true });
  const p = mysql.createPool({
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? "yolo_studio",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME ?? "yolo_studio",
    connectionLimit: 10,
    multipleStatements: true,
  });
  try {
    await p.query(await fs.readFile(path.join(API_DIR, "sql/01_schema.sql"), "utf8"));
    pool = p;
    lastError = null;
    console.log("[db] connected, schema ready");
  } catch (e) {
    await p.end().catch(() => {});
    lastError = (e as Error).message;
    console.warn(`[db] unavailable: ${lastError} (run scripts/setup-db.sh); retrying in 10s`);
    setTimeout(initDb, 10_000);
  }
}

export function dbStatus() {
  return { ok: pool !== null, error: lastError };
}

export function db(): mysql.Pool {
  if (!pool) throw new HttpError(503, `MySQL недоступен: ${lastError}. Запустите scripts/setup-db.sh`);
  return pool;
}

export async function rows<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  const [r] = await db().query(sql, params);
  return r as T[];
}

export async function exec(sql: string, params: unknown[] = []): Promise<mysql.ResultSetHeader> {
  const [r] = await db().query(sql, params);
  return r as mysql.ResultSetHeader;
}
