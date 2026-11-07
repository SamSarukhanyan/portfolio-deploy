import { HttpError } from "./http.js";

const VISION_URL = process.env.VISION_URL ?? "http://127.0.0.1:8001";

export async function vision<T = any>(pathname: string, init?: { method?: string; body?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(VISION_URL + pathname, {
      method: init?.method ?? (init?.body ? "POST" : "GET"),
      headers: init?.body ? { "content-type": "application/json" } : undefined,
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new HttpError(502, `vision-сервис недоступен (${VISION_URL})`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError(res.status, data.detail ?? `vision ${res.status}`);
  return data as T;
}
