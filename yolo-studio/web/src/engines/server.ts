import { canvasToBlob } from "../api";
import type { InferResult, Task } from "../types";

export interface ServerConfig {
  model: string;
  conf: number;
  iou: number;
  imgsz: number;
  max_det: number;
  classes: number[] | null;
  track: boolean;
  tracker: "bytetrack" | "botsort";
  prompts: string[] | null;
  augment: boolean;
  agnostic_nms: boolean;
}

export interface Ready {
  model: string;
  task: Task;
  names: Record<number, string>;
  load_ms: number;
  prompts_ms?: number;
}

/** Ultralytics on the Python service, over one WebSocket. One message in flight at a time. */
export class ServerEngine {
  private ws: WebSocket | null = null;
  private opened: Promise<void> | null = null;
  private waiting: { resolve: (v: any) => void; reject: (e: Error) => void } | null = null;
  private chain: Promise<unknown> = Promise.resolve();

  private connect(): Promise<void> {
    if (this.opened && this.ws && this.ws.readyState <= WebSocket.OPEN) return this.opened;
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${location.host}/vision/ws/infer`);
    ws.binaryType = "arraybuffer";
    this.ws = ws;
    this.opened = new Promise((resolve, reject) => {
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error("vision-сервис недоступен (порт 8001)"));
    });
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data as string);
      const w = this.waiting;
      this.waiting = null;
      if (!w) return;
      if (msg.type === "error") w.reject(new Error(msg.message));
      else w.resolve(msg);
    };
    ws.onclose = () => {
      this.waiting?.reject(new Error("соединение с vision-сервисом закрыто"));
      this.waiting = null;
      this.opened = null;
    };
    return this.opened;
  }

  private send<T>(data: string | ArrayBuffer): Promise<T> {
    const run = async () => {
      await this.connect();
      return new Promise<T>((resolve, reject) => {
        this.waiting = { resolve, reject };
        this.ws!.send(data);
      });
    };
    const p = this.chain.then(run, run);
    this.chain = p.catch(() => {});
    return p;
  }

  configure(cfg: ServerConfig): Promise<Ready> {
    return this.send<Ready>(JSON.stringify({ type: "config", config: cfg }));
  }

  async infer(frame: HTMLCanvasElement): Promise<InferResult> {
    const buf = await (await canvasToBlob(frame, "image/jpeg", 0.8)).arrayBuffer();
    const t0 = performance.now();
    const res = await this.send<InferResult>(buf);
    res.rtt_ms = Math.round(performance.now() - t0);
    return res;
  }

  close() {
    this.ws?.close();
    this.ws = null;
  }
}
