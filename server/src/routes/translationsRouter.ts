import { Router } from "express";
import type { Pool } from "mysql2/promise";
import { fetchBundlesFromDb } from "../copyRepo.js";
import { loadLocalBundles } from "../loadLocalBundles.js";
import { mergeBundles } from "../mergeBundles.js";

export function translationsRouter(pool: Pool | null) {
  const r = Router();

  r.get("/translations", async (_req, res) => {
    const base = loadLocalBundles();
    if (!pool) {
      res.json({ bundles: base });
      return;
    }

    try {
      const fromDb = await fetchBundlesFromDb(pool);
      res.json({ bundles: mergeBundles(base, fromDb) });
    } catch {
      res.json({ bundles: base });
    }
  });

  r.get("/health", (_req, res) => {
    res.json({ ok: true, service: "samsarukhanyan-i18n-api" });
  });

  return r;
}
