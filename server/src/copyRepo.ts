import type { Pool } from "mysql2/promise";
import type { Bundles, MessageMap } from "./types.js";

type CopyRow = { str_key: string; en: string };

export async function fetchBundlesFromDb(pool: Pool): Promise<Partial<Bundles> | null> {
  const [rows] = await pool.query("SELECT str_key, en FROM site_copy");
  const list = rows as CopyRow[];
  if (!list.length) return null;

  const en: MessageMap = {};
  for (const r of list) {
    en[r.str_key] = r.en;
  }

  return { en };
}
