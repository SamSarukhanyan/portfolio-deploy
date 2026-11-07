/** Turns a dataset from MySQL into the folder layout Ultralytics trains on. */
import fs from "node:fs/promises";
import path from "node:path";
import { HttpError } from "./http.js";
import { datasetDir, imagePath, relToData } from "./paths.js";

export type Shape =
  | { type: "box"; cx: number; cy: number; w: number; h: number }
  | { type: "poly"; points: [number, number][] };

export interface Dataset {
  id: number;
  name: string;
  task: "detect" | "segment" | "classify";
  classes: string[];
}

export interface ImageRow {
  id: number;
  filename: string;
  split: "train" | "val";
  annotations: { class_idx: number; shape: Shape | null }[];
}

const f = (n: number) => Math.min(1, Math.max(0, n)).toFixed(6);

function boxOf(s: Shape) {
  if (s.type === "box") return s;
  const xs = s.points.map((p) => p[0]);
  const ys = s.points.map((p) => p[1]);
  const [x1, x2, y1, y2] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  return { cx: (x1 + x2) / 2, cy: (y1 + y2) / 2, w: x2 - x1, h: y2 - y1 };
}

function polyOf(s: Shape): [number, number][] {
  if (s.type === "poly") return s.points;
  const [x1, y1, x2, y2] = [s.cx - s.w / 2, s.cy - s.h / 2, s.cx + s.w / 2, s.cy + s.h / 2];
  return [
    [x1, y1],
    [x2, y1],
    [x2, y2],
    [x1, y2],
  ];
}

function labelLine(task: Dataset["task"], cls: number, s: Shape): string | null {
  if (task === "detect") {
    const b = boxOf(s);
    return b.w > 0 && b.h > 0 ? `${cls} ${f(b.cx)} ${f(b.cy)} ${f(b.w)} ${f(b.h)}` : null;
  }
  const pts = polyOf(s);
  return pts.length >= 3 ? `${cls} ${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(" ")}` : null;
}

/** Use the images marked val; with none, hold out every 5th image (or reuse all when the set is tiny). */
function split<T extends { split: string }>(images: T[]) {
  const val = images.filter((i) => i.split === "val");
  const train = images.filter((i) => i.split !== "val");
  if (val.length) return { train, val, note: null };
  if (train.length >= 10) {
    return {
      train: train.filter((_, i) => i % 5 !== 0),
      val: train.filter((_, i) => i % 5 === 0),
      note: "val: каждое 5-е изображение",
    };
  }
  return { train, val: train, note: "мало данных: val = train" };
}

const safeDir = (name: string) => name.replace(/[^\p{L}\p{N}_-]+/gu, "_").slice(0, 60) || "class";

/** Returns the path (relative to data/) that goes into Ultralytics `data=`. */
export async function buildDataset(ds: Dataset, images: ImageRow[]) {
  if (!images.length) throw new HttpError(400, "в датасете нет изображений");
  if (!ds.classes.length) throw new HttpError(400, "в датасете нет классов");
  const root = path.join(datasetDir(ds.id), "build");
  await fs.rm(root, { recursive: true, force: true });

  if (ds.task === "classify") {
    const labelled = images.filter((i) => i.annotations.length);
    const { train, val, note } = split(labelled);
    const byClass = (list: ImageRow[], c: number) => list.filter((i) => i.annotations[0].class_idx === c);
    const dirs = ds.classes.map(safeDir);
    if (new Set(dirs).size !== dirs.length) throw new HttpError(400, "имена классов совпадают после очистки");
    for (let c = 0; c < ds.classes.length; c++) {
      const tr = byClass(train, c);
      if (!tr.length) throw new HttpError(400, `у класса «${ds.classes[c]}» нет изображений для обучения`);
      const va = byClass(val, c).length ? byClass(val, c) : tr;
      for (const [sub, list] of [["train", tr], ["val", va]] as const) {
        const dir = path.join(root, sub, dirs[c]);
        await fs.mkdir(dir, { recursive: true });
        for (const img of list) await fs.copyFile(imagePath(ds.id, img.filename), path.join(dir, `${img.id}.jpg`));
      }
    }
    return { data: relToData(root), counts: { train: train.length, val: val.length }, note };
  }

  const { train, val, note } = split(images);
  let boxes = 0;
  for (const [sub, list] of [["train", train], ["val", val]] as const) {
    const imgDir = path.join(root, "images", sub);
    const lblDir = path.join(root, "labels", sub);
    await fs.mkdir(imgDir, { recursive: true });
    await fs.mkdir(lblDir, { recursive: true });
    for (const img of list) {
      await fs.copyFile(imagePath(ds.id, img.filename), path.join(imgDir, `${img.id}.jpg`));
      const lines = img.annotations
        .filter((a) => a.shape && a.class_idx < ds.classes.length)
        .map((a) => labelLine(ds.task, a.class_idx, a.shape!))
        .filter((l): l is string => l !== null);
      if (sub === "train") boxes += lines.length;
      await fs.writeFile(path.join(lblDir, `${img.id}.txt`), lines.join("\n"));
    }
  }
  if (!boxes) throw new HttpError(400, "нет ни одной разметки для обучения");

  const yaml = [
    `path: ${JSON.stringify(root)}`,
    "train: images/train",
    "val: images/val",
    "names:",
    ...ds.classes.map((c, i) => `  ${i}: ${JSON.stringify(c)}`),
    "",
  ].join("\n");
  await fs.writeFile(path.join(root, "data.yaml"), yaml);
  return { data: relToData(path.join(root, "data.yaml")), counts: { train: train.length, val: val.length, boxes }, note };
}
