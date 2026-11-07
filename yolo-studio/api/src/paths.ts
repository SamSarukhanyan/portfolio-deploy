import path from "node:path";
import { fileURLToPath } from "node:url";

export const API_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DATA_DIR = path.resolve(process.env.STUDIO_DATA_DIR ?? path.join(API_DIR, "..", "data"));

export const datasetDir = (id: number) => path.join(DATA_DIR, "datasets", String(id));
export const imagePath = (datasetId: number, filename: string) =>
  path.join(datasetDir(datasetId), "images", path.basename(filename));
export const relToData = (p: string) => path.relative(DATA_DIR, p).split(path.sep).join("/");
