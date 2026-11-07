import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { buildDataset, type Dataset, type ImageRow, type Shape } from "./build.js";
import { dbStatus, exec, rows } from "./db.js";
import { HttpError, intParam } from "./http.js";
import { datasetDir, imagePath } from "./paths.js";
import { vision } from "./vision.js";

export const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const TASKS = ["detect", "segment", "classify"] as const;
const TERMINAL = ["done", "failed", "cancelled"];

// ---------- health ----------

router.get("/health", async (_req, res) => {
  const v = await vision("/health").catch((e: Error) => ({ ok: false, error: e.message }));
  res.json({ api: { ok: true, node: process.version }, db: dbStatus(), vision: v });
});

// ---------- datasets ----------

async function getDataset(id: number): Promise<Dataset> {
  const [ds] = await rows<Dataset>("SELECT id, name, task, classes FROM datasets WHERE id = ?", [id]);
  if (!ds) throw new HttpError(404, "датасет не найден");
  return ds;
}

async function getImages(datasetId: number): Promise<(ImageRow & Record<string, unknown>)[]> {
  const imgs = await rows("SELECT * FROM images WHERE dataset_id = ? ORDER BY id DESC", [datasetId]);
  if (!imgs.length) return [];
  const anns = await rows(
    "SELECT id, image_id, class_idx, shape FROM annotations WHERE image_id IN (?) ORDER BY id",
    [imgs.map((i) => i.id)],
  );
  const by = new Map<number, any[]>();
  for (const a of anns) by.set(a.image_id, [...(by.get(a.image_id) ?? []), a]);
  return imgs.map((i) => ({ ...i, annotations: by.get(i.id) ?? [] }));
}

function validShape(s: unknown): Shape | null {
  if (!s || typeof s !== "object") return null;
  const o = s as any;
  const ok = (n: unknown) => typeof n === "number" && Number.isFinite(n);
  if (o.type === "box" && [o.cx, o.cy, o.w, o.h].every(ok)) return { type: "box", cx: o.cx, cy: o.cy, w: o.w, h: o.h };
  if (o.type === "poly" && Array.isArray(o.points) && o.points.length >= 3 && o.points.every((p: any) => ok(p?.[0]) && ok(p?.[1])))
    return { type: "poly", points: o.points.map((p: number[]) => [p[0], p[1]]) };
  return null;
}

/** Accepts {class_idx} or {name}; unknown names are appended to the dataset's classes. */
async function resolveAnnotations(ds: Dataset, input: unknown) {
  if (!Array.isArray(input)) return [];
  const classes = [...ds.classes];
  const out: { class_idx: number; shape: Shape | null }[] = [];
  for (const a of input) {
    let idx: number = typeof a?.class_idx === "number" ? a.class_idx : -1;
    if (idx < 0 && typeof a?.name === "string" && a.name.trim()) {
      idx = classes.indexOf(a.name.trim());
      if (idx < 0) idx = classes.push(a.name.trim()) - 1;
    }
    if (idx < 0 || idx >= classes.length) continue;
    const shape = validShape(a?.shape);
    if (ds.task !== "classify" && !shape) continue;
    out.push({ class_idx: idx, shape: ds.task === "classify" ? null : shape });
    if (ds.task === "classify") break; // one label per image
  }
  if (classes.length !== ds.classes.length) {
    await exec("UPDATE datasets SET classes = ? WHERE id = ?", [JSON.stringify(classes), ds.id]);
    ds.classes = classes;
  }
  return out;
}

async function saveAnnotations(imageId: number, anns: { class_idx: number; shape: Shape | null }[]) {
  await exec("DELETE FROM annotations WHERE image_id = ?", [imageId]);
  if (anns.length)
    await exec("INSERT INTO annotations (image_id, class_idx, shape) VALUES ?", [
      anns.map((a) => [imageId, a.class_idx, a.shape ? JSON.stringify(a.shape) : null]),
    ]);
}

router.get("/datasets", async (_req, res) => {
  res.json(
    await rows(
      `SELECT d.*, (SELECT COUNT(*) FROM images i WHERE i.dataset_id = d.id) AS image_count,
              (SELECT COUNT(*) FROM annotations a JOIN images i ON i.id = a.image_id WHERE i.dataset_id = d.id) AS label_count
       FROM datasets d ORDER BY d.id DESC`,
    ),
  );
});

router.post("/datasets", async (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  const task = req.body?.task ?? "detect";
  const classes: string[] = Array.isArray(req.body?.classes)
    ? [...new Set<string>(req.body.classes.map((c: unknown) => String(c).trim()).filter(Boolean))]
    : [];
  if (!name) throw new HttpError(400, "нужно имя");
  if (!TASKS.includes(task)) throw new HttpError(400, "task: detect | segment | classify");
  const r = await exec("INSERT INTO datasets (name, task, classes) VALUES (?, ?, ?)", [name, task, JSON.stringify(classes)]);
  res.status(201).json(await getDataset(r.insertId));
});

router.get("/datasets/:id", async (req, res) => {
  const ds = await getDataset(intParam(req.params.id));
  res.json({ ...ds, images: await getImages(ds.id) });
});

router.patch("/datasets/:id", async (req, res) => {
  const ds = await getDataset(intParam(req.params.id));
  if (typeof req.body?.name === "string" && req.body.name.trim())
    await exec("UPDATE datasets SET name = ? WHERE id = ?", [req.body.name.trim(), ds.id]);
  if (Array.isArray(req.body?.classes)) {
    // Renames and appends only: indices of existing classes must stay put.
    const next = req.body.classes.map((c: unknown) => String(c).trim());
    if (next.length < ds.classes.length || next.some((c: string) => !c) || new Set(next).size !== next.length)
      throw new HttpError(400, "классы можно переименовывать и добавлять; для удаления есть отдельный запрос");
    await exec("UPDATE datasets SET classes = ? WHERE id = ?", [JSON.stringify(next), ds.id]);
  }
  res.json(await getDataset(ds.id));
});

router.delete("/datasets/:id/classes/:idx", async (req, res) => {
  const ds = await getDataset(intParam(req.params.id));
  const idx = Number(req.params.idx);
  if (!Number.isInteger(idx) || idx < 0 || idx >= ds.classes.length) throw new HttpError(400, "bad class index");
  const scope = "image_id IN (SELECT id FROM images WHERE dataset_id = ?)";
  await exec(`DELETE FROM annotations WHERE class_idx = ? AND ${scope}`, [idx, ds.id]);
  await exec(`UPDATE annotations SET class_idx = class_idx - 1 WHERE class_idx > ? AND ${scope}`, [idx, ds.id]);
  const classes = ds.classes.filter((_, i) => i !== idx);
  await exec("UPDATE datasets SET classes = ? WHERE id = ?", [JSON.stringify(classes), ds.id]);
  res.json(await getDataset(ds.id));
});

router.delete("/datasets/:id", async (req, res) => {
  const id = intParam(req.params.id);
  await exec("DELETE FROM datasets WHERE id = ?", [id]);
  await fs.rm(datasetDir(id), { recursive: true, force: true });
  res.status(204).end();
});

router.post("/datasets/:id/images", upload.single("image"), async (req, res) => {
  const ds = await getDataset(intParam(req.params.id));
  if (!req.file) throw new HttpError(400, "нет файла image");
  if (!/^image\//.test(req.file.mimetype)) throw new HttpError(400, "нужно изображение");
  const width = intParam(req.body.width, "width");
  const height = intParam(req.body.height, "height");
  const ext = req.file.mimetype === "image/png" ? ".png" : req.file.mimetype === "image/webp" ? ".webp" : ".jpg";
  const filename = randomUUID() + ext;
  await fs.mkdir(path.dirname(imagePath(ds.id, filename)), { recursive: true });
  await fs.writeFile(imagePath(ds.id, filename), req.file.buffer);
  const split = req.body.split === "val" ? "val" : "train";
  const source = String(req.body.source ?? "upload").slice(0, 40);
  const r = await exec(
    "INSERT INTO images (dataset_id, filename, width, height, split, source) VALUES (?, ?, ?, ?, ?, ?)",
    [ds.id, filename, width, height, split, source],
  );
  const anns = await resolveAnnotations(ds, req.body.annotations ? JSON.parse(req.body.annotations) : []);
  await saveAnnotations(r.insertId, anns);
  res.status(201).json({ id: r.insertId, filename, classes: ds.classes, annotations: anns.length });
});

async function getImage(id: number) {
  const [img] = await rows("SELECT * FROM images WHERE id = ?", [id]);
  if (!img) throw new HttpError(404, "изображение не найдено");
  return img;
}

router.get("/images/:id/file", async (req, res) => {
  const img = await getImage(intParam(req.params.id));
  res.sendFile(imagePath(img.dataset_id, img.filename), { maxAge: "1d" });
});

router.put("/images/:id", async (req, res) => {
  const img = await getImage(intParam(req.params.id));
  if (req.body?.split === "train" || req.body?.split === "val")
    await exec("UPDATE images SET split = ? WHERE id = ?", [req.body.split, img.id]);
  let classes: string[] | undefined;
  if (req.body?.annotations) {
    const ds = await getDataset(img.dataset_id);
    await saveAnnotations(img.id, await resolveAnnotations(ds, req.body.annotations));
    classes = ds.classes;
  }
  res.json({ ok: true, classes });
});

router.delete("/images/:id", async (req, res) => {
  const img = await getImage(intParam(req.params.id));
  await exec("DELETE FROM images WHERE id = ?", [img.id]);
  await fs.rm(imagePath(img.dataset_id, img.filename), { force: true });
  res.status(204).end();
});

// ---------- training ----------

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "ds";

router.post("/datasets/:id/train", async (req, res) => {
  const ds = await getDataset(intParam(req.params.id));
  const model = String(req.body?.model ?? "");
  if (!model) throw new HttpError(400, "выберите базовую модель");
  const epochs = Math.min(1000, Math.max(1, Number(req.body?.epochs) || 30));
  const imgsz = Math.min(1280, Math.max(64, Number(req.body?.imgsz) || 320));
  const batch = Math.min(128, Math.max(1, Number(req.body?.batch) || 8));
  const patience = Math.max(1, Number(req.body?.patience) || 20);
  const built = await buildDataset(ds, await getImages(ds.id));
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const job = await vision("/jobs", {
    body: {
      kind: "train",
      params: { model, data: built.data, epochs, imgsz, batch, patience, name: `ds${ds.id}-${slug(ds.name)}-${stamp}` },
    },
  });
  const r = await exec(
    "INSERT INTO training_runs (dataset_id, job_id, base_model, epochs, imgsz, batch, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [ds.id, job.id, model, epochs, imgsz, batch, job.state],
  );
  res.status(201).json({ id: r.insertId, job, build: built });
});

router.post("/datasets/:id/val", async (req, res) => {
  const ds = await getDataset(intParam(req.params.id));
  const built = await buildDataset(ds, await getImages(ds.id));
  const job = await vision("/jobs", {
    body: { kind: "val", params: { model: String(req.body?.model ?? ""), data: built.data, imgsz: Number(req.body?.imgsz) || 640 } },
  });
  res.status(201).json({ job, build: built });
});

/** Pulls the job state from the vision service into MySQL. */
async function syncRun(run: any) {
  if (TERMINAL.includes(run.status)) return { run, job: null };
  const job = await vision(`/jobs/${run.job_id}`).catch(() => null);
  if (!job) return { run, job: null };
  const last = job.history?.at(-1) ?? null;
  const metrics = job.result?.metrics ?? last;
  await exec(
    "UPDATE training_runs SET status = ?, metrics = ?, best_model = ?, error = ?, finished_at = IF(? IN ('done','failed','cancelled'), NOW(), NULL) WHERE id = ?",
    [job.state, metrics ? JSON.stringify(metrics) : null, job.result?.best ?? null, job.error ?? null, job.state, run.id],
  );
  return { run: { ...run, status: job.state, metrics, best_model: job.result?.best ?? null, error: job.error ?? null }, job };
}

const RUNS_SQL = `SELECT r.*, d.name AS dataset_name, d.task AS dataset_task FROM training_runs r
                  LEFT JOIN datasets d ON d.id = r.dataset_id`;

router.get("/runs", async (_req, res) => {
  const list = await rows(`${RUNS_SQL} ORDER BY r.id DESC LIMIT 100`);
  res.json(await Promise.all(list.map(async (r) => (await syncRun(r)).run)));
});

router.get("/runs/:id", async (req, res) => {
  const [run] = await rows(`${RUNS_SQL} WHERE r.id = ?`, [intParam(req.params.id)]);
  if (!run) throw new HttpError(404, "запуск не найден");
  const synced = await syncRun(run);
  const job = synced.job ?? (await vision(`/jobs/${run.job_id}`).catch(() => null));
  res.json({ ...synced.run, job });
});

router.post("/runs/:id/cancel", async (req, res) => {
  const [run] = await rows("SELECT * FROM training_runs WHERE id = ?", [intParam(req.params.id)]);
  if (!run) throw new HttpError(404, "запуск не найден");
  await vision(`/jobs/${run.job_id}/cancel`, { method: "POST" });
  res.json((await syncRun(run)).run);
});

router.delete("/runs/:id", async (req, res) => {
  await exec("DELETE FROM training_runs WHERE id = ?", [intParam(req.params.id)]);
  res.status(204).end();
});

// ---------- live sessions ----------

router.post("/sessions", async (req, res) => {
  const b = req.body ?? {};
  const r = await exec("INSERT INTO sessions (engine, model, task, source) VALUES (?, ?, ?, ?)", [
    String(b.engine ?? "server").slice(0, 20),
    String(b.model ?? "").slice(0, 200),
    b.task ? String(b.task).slice(0, 20) : null,
    String(b.source ?? "camera").slice(0, 20),
  ]);
  res.status(201).json({ id: r.insertId });
});

router.patch("/sessions/:id", async (req, res) => {
  const b = req.body ?? {};
  await exec("UPDATE sessions SET frames = ?, avg_ms = ?, fps = ?, counts = ?, unique_tracks = ?, task = COALESCE(?, task) WHERE id = ?", [
    Number(b.frames) || 0,
    Number.isFinite(b.avg_ms) ? b.avg_ms : null,
    Number.isFinite(b.fps) ? b.fps : null,
    JSON.stringify(b.counts ?? {}),
    JSON.stringify(b.unique_tracks ?? {}),
    b.task ? String(b.task).slice(0, 20) : null,
    intParam(req.params.id),
  ]);
  res.json({ ok: true });
});

router.get("/sessions", async (_req, res) => {
  res.json(await rows("SELECT * FROM sessions WHERE frames > 0 ORDER BY id DESC LIMIT 50"));
});
