export type Task = "detect" | "segment" | "pose" | "obb" | "classify" | "semantic" | "depth";

export const TASK_LABEL: Record<string, string> = {
  detect: "Детекция",
  segment: "Сегментация",
  pose: "Позы",
  obb: "Повёрнутые рамки",
  classify: "Классификация",
  semantic: "Семантика",
  depth: "Глубина",
};

export type Pt = [number, number];

export interface Det {
  cls: number;
  name: string;
  conf: number;
  box: [number, number, number, number];
  id?: number;
  poly?: Pt[];
  kpts?: [number, number, number][];
  obb?: Pt[];
}

export interface InferResult {
  w: number;
  h: number;
  task: Task;
  speed: Record<string, number>;
  detections: Det[];
  top5?: { cls: number; name: string; conf: number }[];
  semantic?: { png: string; classes: { cls: number; name: string; share: number }[] };
  depth?: { png: string; min: number; max: number };
  server_ms?: number;
  rtt_ms?: number;
  /** decoded dense overlay (semantic/depth), filled in by the live page */
  overlay?: HTMLImageElement;
}

export interface ModelInfo {
  id: string;
  task: Task;
  family: string;
  size?: string;
  kind: string;
  title?: string;
  downloaded: boolean;
}

export interface OnnxModel {
  path: string;
  task: Task;
  names: Record<number, string>;
  imgsz: number[];
  end2end: boolean;
  size_mb: number;
}

export interface Job {
  id: string;
  kind: "train" | "val" | "export" | "download";
  state: "queued" | "running" | "done" | "failed" | "cancelled";
  params: Record<string, any>;
  error?: string;
  result?: Record<string, any>;
  epoch?: number;
  epochs?: number;
  batch_i?: number;
  batches?: number;
  history?: Record<string, number | null>[];
  save_dir?: string;
  log?: string;
  created: number;
  started?: number;
  finished?: number;
}

export type Shape = { type: "box"; cx: number; cy: number; w: number; h: number } | { type: "poly"; points: Pt[] };

export interface Annotation {
  class_idx: number;
  shape: Shape | null;
}

export interface Dataset {
  id: number;
  name: string;
  task: "detect" | "segment" | "classify";
  classes: string[];
  image_count?: number;
  label_count?: number;
}

export interface ImageRow {
  id: number;
  dataset_id: number;
  filename: string;
  width: number;
  height: number;
  split: "train" | "val";
  source: string;
  annotations: Annotation[];
}

export interface Run {
  id: number;
  dataset_id: number | null;
  dataset_name?: string;
  dataset_task?: string;
  job_id: string;
  base_model: string;
  epochs: number;
  imgsz: number;
  batch: number;
  status: Job["state"];
  metrics: Record<string, number | null> | null;
  best_model: string | null;
  error: string | null;
  created_at: string;
  job?: Job | null;
}
