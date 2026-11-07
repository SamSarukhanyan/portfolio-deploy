"""Vision service: Ultralytics YOLO inference over WebSocket, plus train/val/export jobs."""
import asyncio
import json
import os
import platform
import time

from fastapi import FastAPI, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from pydantic import BaseModel

from . import jobs
from .config import DATA_DIR, DEVICE, THREADS, inside_data
from .inference import Session, decode_jpeg
from .registry import catalog, onnx_models

# No anonymous usage analytics from this dev tool.
try:
    from ultralytics import settings as yolo_settings

    if yolo_settings.get("sync"):
        yolo_settings.update({"sync": False})
except Exception:
    pass

import torch

torch.set_num_threads(THREADS)

app = FastAPI(title="YOLO Studio vision")


@app.get("/health")
def health():
    import torch
    import ultralytics

    return {
        "ok": True,
        "ultralytics": ultralytics.__version__,
        "torch": torch.__version__,
        "python": platform.python_version(),
        "device": DEVICE,
        "cuda": torch.cuda.is_available(),
        "threads": torch.get_num_threads(),
        "cpu": platform.processor() or platform.machine(),
        "cpus": os.cpu_count(),
        "data_dir": str(DATA_DIR),
    }


@app.get("/models")
def models():
    return {"models": catalog(), "onnx": onnx_models()}


@app.websocket("/ws/infer")
async def ws_infer(ws: WebSocket):
    """Protocol: text frames are JSON {"type":"config", ...}; binary frames are JPEG images.
    Every frame gets exactly one reply, so the client sends the next one when the reply arrives."""
    await ws.accept()
    session = Session()
    try:
        while True:
            msg = await ws.receive()
            if msg["type"] == "websocket.disconnect":
                break
            if msg.get("text") is not None:
                try:
                    data = json.loads(msg["text"])
                    if data.get("type") == "config":
                        info = await asyncio.to_thread(session.configure, data.get("config") or {})
                        await ws.send_json({"type": "ready", **info})
                except Exception as e:
                    await ws.send_json({"type": "error", "message": f"{type(e).__name__}: {e}"})
                continue
            if msg.get("bytes") is not None:
                t0 = time.perf_counter()
                try:
                    if session.model is None:
                        await asyncio.to_thread(session.configure, {})
                    img = decode_jpeg(msg["bytes"])
                    out = await asyncio.to_thread(session.infer, img)
                    out["type"] = "result"
                    out["server_ms"] = round((time.perf_counter() - t0) * 1000, 1)
                    await ws.send_json(out)
                except Exception as e:
                    await ws.send_json({"type": "error", "message": f"{type(e).__name__}: {e}"})
    except WebSocketDisconnect:
        pass


@app.post("/predict")
async def predict(file: UploadFile = File(...), config: str = Form("{}")):
    session = Session()
    try:
        info = await asyncio.to_thread(session.configure, json.loads(config))
        img = decode_jpeg(await file.read())
        out = await asyncio.to_thread(session.infer, img)
    except Exception as e:
        raise HTTPException(400, f"{type(e).__name__}: {e}")
    return {**out, "names": info["names"]}


class JobIn(BaseModel):
    kind: str
    params: dict


@app.post("/jobs")
def create_job(body: JobIn):
    try:
        return jobs.start(body.kind, body.params)
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.get("/jobs")
def list_jobs(kind: str | None = None):
    return {"jobs": jobs.list_jobs(kind)}


@app.get("/jobs/{job_id}")
def get_job(job_id: str):
    try:
        return jobs.get(job_id)
    except (FileNotFoundError, ValueError):
        raise HTTPException(404, "job not found")


@app.post("/jobs/{job_id}/cancel")
def cancel_job(job_id: str):
    try:
        return jobs.cancel(job_id)
    except (FileNotFoundError, ValueError):
        raise HTTPException(404, "job not found")


@app.get("/files/{path:path}")
def files(path: str, download: bool = False):
    try:
        p = inside_data(path)
    except ValueError:
        raise HTTPException(400, "bad path")
    if not p.is_file():
        raise HTTPException(404, "not found")
    return FileResponse(p, filename=p.name if download else None)


@app.get("/ls/{path:path}")
def ls(path: str):
    """List a folder inside data/ (training plots, export folders)."""
    try:
        p = inside_data(path)
    except ValueError:
        raise HTTPException(400, "bad path")
    if not p.is_dir():
        raise HTTPException(404, "not found")
    return {
        "files": sorted(
            [{"name": c.name, "dir": c.is_dir(), "size": c.stat().st_size if c.is_file() else None} for c in p.iterdir()],
            key=lambda f: (not f["dir"], f["name"]),
        )
    }
