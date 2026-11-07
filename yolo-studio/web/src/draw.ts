import type { InferResult, Pt } from "./types";

export const color = (cls: number, a = 1) => `hsla(${(cls * 47) % 360} 90% 55% / ${a})`;

// COCO-17 skeleton, keypoint index pairs
const SKELETON: [number, number][] = [
  [15, 13], [13, 11], [16, 14], [14, 12], [11, 12], [5, 11], [6, 12], [5, 6], [5, 7],
  [6, 8], [7, 9], [8, 10], [1, 2], [0, 1], [0, 2], [1, 3], [2, 4], [3, 5], [4, 6],
];

export interface DrawOpts {
  boxes: boolean;
  labels: boolean;
  masks: boolean;
  kpts: boolean;
  trails: boolean;
  dense: number; // opacity of semantic/depth overlays, 0 = off
}

export type Trails = Map<number, { cls: number; pts: Pt[]; seen: number }>;

/** Draws a result computed on a frame of res.w × res.h onto a canvas of width × height. */
export function drawResult(ctx: CanvasRenderingContext2D, res: InferResult, width: number, height: number, o: DrawOpts, trails?: Trails) {
  const sx = width / res.w;
  const sy = height / res.h;
  const lw = Math.max(2, Math.round(Math.min(width, height) / 300));
  const font = Math.max(12, Math.round(Math.min(width, height) / 40));
  ctx.lineJoin = "round";

  if (res.overlay && o.dense > 0) {
    ctx.globalAlpha = o.dense;
    ctx.drawImage(res.overlay, 0, 0, width, height);
    ctx.globalAlpha = 1;
  }

  if (trails && o.trails) {
    for (const t of trails.values()) {
      if (t.pts.length < 2) continue;
      ctx.strokeStyle = color(t.cls, 0.8);
      ctx.lineWidth = lw;
      ctx.beginPath();
      t.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * sx, y * sy) : ctx.moveTo(x * sx, y * sy)));
      ctx.stroke();
    }
  }

  const path = (pts: Pt[]) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * sx, y * sy) : ctx.moveTo(x * sx, y * sy)));
    ctx.closePath();
  };

  for (const d of res.detections) {
    const c = color(d.cls);
    ctx.lineWidth = lw;
    if (d.poly?.length && o.masks) {
      path(d.poly);
      ctx.fillStyle = color(d.cls, 0.35);
      ctx.fill();
      ctx.strokeStyle = c;
      ctx.stroke();
    }
    if (d.obb && o.boxes) {
      path(d.obb);
      ctx.strokeStyle = c;
      ctx.stroke();
    } else if (o.boxes) {
      const [x1, y1, x2, y2] = d.box;
      ctx.strokeStyle = c;
      ctx.strokeRect(x1 * sx, y1 * sy, (x2 - x1) * sx, (y2 - y1) * sy);
    }
    if (d.kpts && o.kpts) {
      ctx.strokeStyle = color(d.cls + 3, 0.9);
      for (const [a, b] of SKELETON) {
        const p = d.kpts[a];
        const q = d.kpts[b];
        if (!p || !q || p[2] < 0.5 || q[2] < 0.5) continue;
        ctx.beginPath();
        ctx.moveTo(p[0] * sx, p[1] * sy);
        ctx.lineTo(q[0] * sx, q[1] * sy);
        ctx.stroke();
      }
      ctx.fillStyle = "#fff";
      for (const [x, y, s] of d.kpts) {
        if (s < 0.5) continue;
        ctx.beginPath();
        ctx.arc(x * sx, y * sy, lw + 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (o.labels) {
      const text = `${d.id !== undefined ? `#${d.id} ` : ""}${d.name} ${(d.conf * 100).toFixed(0)}%`;
      ctx.font = `600 ${font}px system-ui, sans-serif`;
      const tw = ctx.measureText(text).width + 8;
      const x = (d.obb ? Math.min(...d.obb.map((p) => p[0])) : d.box[0]) * sx;
      const y = Math.max(font + 4, (d.obb ? Math.min(...d.obb.map((p) => p[1])) : d.box[1]) * sy);
      ctx.fillStyle = c;
      ctx.fillRect(x, y - font - 4, tw, font + 4);
      ctx.fillStyle = "#000";
      ctx.fillText(text, x + 4, y - 4);
    }
  }
}

/** Updates track trails (in result-frame coordinates) and counts unique ids per class. */
export function updateTracks(res: InferResult, trails: Trails, unique: Map<string, Set<number>>, frame: number) {
  for (const d of res.detections) {
    if (d.id === undefined) continue;
    const cx = (d.box[0] + d.box[2]) / 2;
    const cy = (d.box[1] + d.box[3]) / 2;
    const t = trails.get(d.id) ?? { cls: d.cls, pts: [], seen: frame };
    t.pts.push([cx, cy]);
    if (t.pts.length > 40) t.pts.shift();
    t.seen = frame;
    trails.set(d.id, t);
    if (!unique.has(d.name)) unique.set(d.name, new Set());
    unique.get(d.name)!.add(d.id);
  }
  for (const [id, t] of trails) if (frame - t.seen > 30) trails.delete(id);
}
