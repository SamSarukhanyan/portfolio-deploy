import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Bundles } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function loadLocalBundles(): Bundles {
  const jsonPath = path.join(__dirname, "../../client/src/i18n/bundles.default.json");
  const raw = readFileSync(jsonPath, "utf8");
  return JSON.parse(raw) as Bundles;
}
