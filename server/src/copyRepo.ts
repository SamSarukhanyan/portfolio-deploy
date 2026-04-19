import type { Pool } from "mysql2/promise";
import type { Bundles, MessageMap } from "./types.js";

type CopyRow = { str_key: string; en: string; ru: string; hy: string };

export async function fetchBundlesFromDb(pool: Pool): Promise<Partial<Bundles> | null> {
  const [rows] = await pool.query("SELECT str_key, en, ru, hy FROM site_copy");
  const list = rows as CopyRow[];
  if (!list.length) return null;

  const en: MessageMap = {};
  const ru: MessageMap = {};
  const hy: MessageMap = {};

  for (const r of list) {
    en[r.str_key] = r.en;
    ru[r.str_key] = r.ru;
    hy[r.str_key] = r.hy;
  }

  return { en, ru, hy };
}
