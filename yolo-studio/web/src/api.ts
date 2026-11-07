async function request<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(path, {
    ...rest,
    headers: json !== undefined ? { "content-type": "application/json" } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = body.error ?? body.detail;
    throw new Error(typeof detail === "string" ? detail : `${res.status} ${res.statusText}`);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const get = <T>(path: string) => request<T>(path);
export const post = <T>(path: string, json?: unknown) => request<T>(path, { method: "POST", json: json ?? {} });
export const put = <T>(path: string, json: unknown) => request<T>(path, { method: "PUT", json });
export const patch = <T>(path: string, json: unknown) => request<T>(path, { method: "PATCH", json });
export const del = (path: string) => request<void>(path, { method: "DELETE" });
export const postForm = <T>(path: string, form: FormData) => request<T>(path, { method: "POST", body: form });

/** URL of a file inside data/ served by the vision service. */
export const fileUrl = (rel: string, download = false) =>
  `/vision/files/${rel.split("/").map(encodeURIComponent).join("/")}${download ? "?download=true" : ""}`;

const KEY = "yolo-studio.";
export const store = {
  get<T>(k: string, fallback: T): T {
    try {
      const v = localStorage.getItem(KEY + k);
      return v === null ? fallback : (JSON.parse(v) as T);
    } catch {
      return fallback;
    }
  },
  set(k: string, v: unknown) {
    try {
      localStorage.setItem(KEY + k, JSON.stringify(v));
    } catch {
      /* storage may be unavailable */
    }
  },
};

export function canvasToBlob(c: HTMLCanvasElement, type = "image/jpeg", q = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), type, q));
}
