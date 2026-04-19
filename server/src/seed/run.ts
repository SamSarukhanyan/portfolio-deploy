import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import type { Bundles } from "../types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadSeedJson(): Bundles {
  const jsonPath = path.join(__dirname, "../../../client/src/i18n/bundles.default.json");
  return JSON.parse(readFileSync(jsonPath, "utf8")) as Bundles;
}

async function main() {
  const bundles = loadSeedJson();
  const keys = Object.keys(bundles.en);

  const pool = mysql.createPool({
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.DB_PORT ?? "3306"),
    user: process.env.DB_USER ?? "root",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME ?? "samsarukhanyan_portfolio",
    waitForConnections: true,
    connectionLimit: 4,
  });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const sql =
      "INSERT INTO site_copy (str_key, en, ru, hy) VALUES (?, ?, ?, ?) " +
      "ON DUPLICATE KEY UPDATE en = VALUES(en), ru = VALUES(ru), hy = VALUES(hy)";
    for (const key of keys) {
      await conn.execute(sql, [key, bundles.en[key], bundles.ru[key], bundles.hy[key]]);
    }
    await conn.commit();
    console.log(`Seeded ${keys.length} keys into site_copy`);
  } catch (err) {
    await conn.rollback();
    console.error("Seed failed:", err);
    process.exitCode = 1;
  } finally {
    conn.release();
    await pool.end();
  }
}

await main();
