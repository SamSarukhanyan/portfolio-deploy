/** Runs an exported Ultralytics ONNX model right in the browser (WebGPU, falling back to WASM). */
import * as ort from "onnxruntime-web/webgpu";
import { fileUrl } from "../api";
import type { Det, InferResult, OnnxModel } from "../types";

ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${__ORT_VERSION__}/dist/`;
ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(8, navigator.hardwareConcurrency || 4) : 1;

export const BROWSER_TASKS = ["detect", "pose", "classify"];

export interface BrowserConfig {
  conf: number;
  iou: number;
  max_det: number;
  classes: number[] | null;
  agnostic_nms: boolean;
}

export class BrowserEngine {
  private session: ort.InferenceSession | null = null;
  private canvas = document.createElement("canvas");
  model: OnnxModel | null = null;
  backend = "";
  cfg: BrowserConfig = { conf: 0.25, iou: 0.7, max_det: 100, classes: null, agnostic_nms: false };

  async load(model: OnnxModel) {
    if (!BROWSER_TASKS.includes(model.task)) throw new Error(`в браузере доступны: ${BROWSER_TASKS.join(", ")}`);
    await this.session?.release();
    this.session = null;
    const bytes = await (await fetch(fileUrl(model.path))).arrayBuffer();
    const t0 = performance.now();
    for (const ep of ["webgpu", "wasm"]) {
      try {
        this.session = await ort.InferenceSession.create(bytes, { executionProviders: [ep], graphOptimizationLevel: "all" });
        this.backend = ep === "wasm" ? `wasm×${ort.env.wasm.numThreads}` : ep;
        break;
      } catch (e) {
        if (ep === "wasm") throw e;
      }
    }
    this.model = model;
    return { load_ms: Math.round(performance.now() - t0), backend: this.backend };
  }

  async infer(frame: HTMLCanvasElement): Promise<InferResult> {
    if (!this.session || !this.model) throw new Error("ONNX-модель не загружена");
    const m = this.model;
    const [S] = m.imgsz;
    const W = frame.width;
    const H = frame.height;
    const t0 = performance.now();

    // letterbox (detect/pose) or centre crop (classify), like Ultralytics preprocessing
    const c = this.canvas;
    c.width = S;
    c.height = S;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    let r: number, px: number, py: number;
    if (m.task === "classify") {
      const side = Math.min(W, H);
      ctx.drawImage(frame, (W - side) / 2, (H - side) / 2, side, side, 0, 0, S, S);
      r = S / side;
      px = py = 0;
    } else {
      r = Math.min(S / W, S / H);
      const nw = Math.round(W * r);
      const nh = Math.round(H * r);
      px = (S - nw) / 2;
      py = (S - nh) / 2;
      ctx.fillStyle = "rgb(114,114,114)";
      ctx.fillRect(0, 0, S, S);
      ctx.drawImage(frame, px, py, nw, nh);
    }
    const px8 = ctx.getImageData(0, 0, S, S).data;
    const plane = S * S;
    const input = new Float32Array(3 * plane);
    for (let i = 0; i < plane; i++) {
      input[i] = px8[i * 4] / 255;
      input[plane + i] = px8[i * 4 + 1] / 255;
      input[2 * plane + i] = px8[i * 4 + 2] / 255;
    }
    const t1 = performance.now();
    const feeds = { [this.session.inputNames[0]]: new ort.Tensor("float32", input, [1, 3, S, S]) };
    const out = (await this.session.run(feeds))[this.session.outputNames[0]];
    const t2 = performance.now();
    const data = out.data as Float32Array;
    const res: InferResult = { w: W, h: H, task: m.task, speed: {}, detections: [] };

    if (m.task === "classify") {
      const probs = Array.from(data.slice(0, out.dims[1]));
      res.top5 = probs
        .map((conf, cls) => ({ cls, conf, name: m.names[cls] ?? String(cls) }))
        .sort((a, b) => b.conf - a.conf)
        .slice(0, 5);
    } else {
      res.detections = this.decode(data, out.dims as number[], (x, y) => [(x - px) / r, (y - py) / r]);
    }
    const t3 = performance.now();
    res.speed = { preprocess: +(t1 - t0).toFixed(2), inference: +(t2 - t1).toFixed(2), postprocess: +(t3 - t2).toFixed(2) };
    res.rtt_ms = Math.round(t3 - t0);
    return res;
  }

  private keep(cls: number) {
    return !this.cfg.classes?.length || this.cfg.classes.includes(cls);
  }

  private decode(d: Float32Array, dims: number[], unmap: (x: number, y: number) => [number, number]): Det[] {
    const m = this.model!;
    const { conf: minConf, iou, max_det } = this.cfg;
    const pose = m.task === "pose";
    const cand: Det[] = [];
    const [, a, b] = dims;
    const box = (x1: number, y1: number, x2: number, y2: number): Det["box"] => {
      const [ax, ay] = unmap(x1, y1);
      const [bx, by] = unmap(x2, y2);
      return [ax, ay, bx, by];
    };
    const kpts = (get: (j: number) => number, n: number) =>
      Array.from({ length: n }, (_, k) => {
        const [x, y] = unmap(get(k * 3), get(k * 3 + 1));
        return [x, y, get(k * 3 + 2)] as [number, number, number];
      });

    if (a > b) {
      // end-to-end export (YOLO26 / v10): [1, N, 6 (+ kpts)] = x1 y1 x2 y2 conf cls ...
      for (let i = 0; i < a; i++) {
        const o = i * b;
        const conf = d[o + 4];
        const cls = Math.round(d[o + 5]);
        if (conf < minConf || !this.keep(cls)) continue;
        const det: Det = { cls, conf, name: m.names[cls] ?? String(cls), box: box(d[o], d[o + 1], d[o + 2], d[o + 3]) };
        if (pose) det.kpts = kpts((j) => d[o + 6 + j], (b - 6) / 3);
        cand.push(det);
      }
      return cand.sort((x, y) => y.conf - x.conf).slice(0, max_det);
    }

    // raw head output: [1, 4 + classes (+ kpts), N] in cx cy w h, needs NMS
    const N = b;
    const nc = pose ? 1 : a - 4;
    for (let i = 0; i < N; i++) {
      let best = 0;
      let cls = 0;
      for (let k = 0; k < nc; k++) {
        const s = d[(4 + k) * N + i];
        if (s > best) {
          best = s;
          cls = k;
        }
      }
      if (best < minConf || !this.keep(cls)) continue;
      const cx = d[i], cy = d[N + i], w = d[2 * N + i], h = d[3 * N + i];
      const det: Det = { cls, conf: best, name: m.names[cls] ?? String(cls), box: box(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2) };
      if (pose) det.kpts = kpts((j) => d[(5 + j) * N + i], (a - 5) / 3);
      cand.push(det);
    }
    return nms(cand, iou, this.cfg.agnostic_nms).slice(0, max_det);
  }

  close() {
    void this.session?.release();
    this.session = null;
  }
}

function iouOf(a: Det["box"], b: Det["box"]) {
  const iw = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]));
  const ih = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  const inter = iw * ih;
  return inter / ((a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter + 1e-9);
}

function nms(dets: Det[], thr: number, agnostic: boolean): Det[] {
  dets.sort((x, y) => y.conf - x.conf);
  const top = dets.slice(0, 3000);
  const out: Det[] = [];
  for (const d of top) {
    if (out.every((k) => (!agnostic && k.cls !== d.cls) || iouOf(k.box, d.box) < thr)) out.push(d);
  }
  return out;
}
