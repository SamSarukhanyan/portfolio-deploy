"""Long jobs (train, val, export, download) run as child processes so the camera stays responsive.

Each job owns a folder under data/jobs/<id>/ with params.json, status.json and log.txt,
so job state survives a restart of this service.
"""
import json
import subprocess
import sys
import time
import uuid
from pathlib import Path

from .config import JOBS_DIR, VISION_DIR

KINDS = {"train", "val", "export", "download"}
_procs: dict[str, subprocess.Popen] = {}


def _dir(job_id: str) -> Path:
    d = (JOBS_DIR / job_id).resolve()
    if d.parent != JOBS_DIR.resolve():
        raise ValueError("bad job id")
    return d


def write_status(job_dir: Path, status: dict):
    tmp = job_dir / "status.json.tmp"
    tmp.write_text(json.dumps(status))
    tmp.replace(job_dir / "status.json")


def start(kind: str, params: dict) -> dict:
    if kind not in KINDS:
        raise ValueError(f"unknown job kind {kind}")
    job_id = f"{kind}-{time.strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:6]}"
    d = _dir(job_id)
    d.mkdir(parents=True)
    (d / "params.json").write_text(json.dumps({"kind": kind, **params}))
    write_status(d, {"id": job_id, "kind": kind, "state": "queued", "params": params, "created": time.time()})
    log = open(d / "log.txt", "w")
    _procs[job_id] = subprocess.Popen(
        [sys.executable, "-m", "app.worker", str(d)],
        cwd=VISION_DIR,
        stdout=log,
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )
    return get(job_id)


def _tail(path: Path, n=40) -> str:
    if not path.exists():
        return ""
    lines = path.read_text(errors="replace").replace("\r", "\n").splitlines()
    return "\n".join(l for l in lines[-n * 3 :] if l.strip())[-6000:]


def get(job_id: str) -> dict:
    d = _dir(job_id)
    if not (d / "status.json").exists():
        raise FileNotFoundError(job_id)
    st = json.loads((d / "status.json").read_text())
    proc = _procs.get(job_id)
    if st["state"] in ("queued", "running"):
        exited = proc is None or proc.poll() is not None
        if exited:
            st["state"] = "failed"
            st["error"] = st.get("error") or (
                "процесс завершился неожиданно" if proc else "сервис был перезапущен во время задачи"
            )
            write_status(d, st)
    st["log"] = _tail(d / "log.txt")
    return st


def cancel(job_id: str) -> dict:
    d = _dir(job_id)
    proc = _procs.get(job_id)
    if proc and proc.poll() is None:
        proc.terminate()
        try:
            proc.wait(10)
        except subprocess.TimeoutExpired:
            proc.kill()
    st = json.loads((d / "status.json").read_text())
    if st["state"] in ("queued", "running"):
        st["state"] = "cancelled"
        st["finished"] = time.time()
        write_status(d, st)
    return get(job_id)


def list_jobs(kind: str | None = None, limit=50) -> list[dict]:
    out = []
    for d in sorted(JOBS_DIR.iterdir(), key=lambda p: p.name.split("-", 1)[-1], reverse=True):
        if not (d / "status.json").exists():
            continue
        if kind and not d.name.startswith(kind + "-"):
            continue
        st = get(d.name)
        st.pop("log", None)
        out.append(st)
        if len(out) >= limit:
            break
    return out
