import os
from pathlib import Path

VISION_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = Path(os.environ.get("STUDIO_DATA_DIR", VISION_DIR.parent / "data")).resolve()

MODELS_DIR = DATA_DIR / "models"
RUNS_DIR = DATA_DIR / "runs"
JOBS_DIR = DATA_DIR / "jobs"

for d in (MODELS_DIR, RUNS_DIR, JOBS_DIR):
    d.mkdir(parents=True, exist_ok=True)

DEVICE = os.environ.get("STUDIO_DEVICE", "cpu")

# Ultralytics sets OMP_NUM_THREADS=1 on import, which leaves PyTorch on one core.
THREADS = int(os.environ.get("STUDIO_THREADS", max(1, (os.cpu_count() or 2) // 2)))
os.environ.setdefault("OMP_NUM_THREADS", str(THREADS))


def rel(path) -> str:
    """Path relative to DATA_DIR, as the API and the browser see it."""
    return Path(path).resolve().relative_to(DATA_DIR).as_posix()


def inside_data(rel_path: str) -> Path:
    p = (DATA_DIR / rel_path).resolve()
    if p != DATA_DIR and DATA_DIR not in p.parents:
        raise ValueError("path escapes the data directory")
    return p
