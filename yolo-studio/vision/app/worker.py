"""Child process that runs one job. Usage: python -m app.worker <job_dir>"""
import json
import math
import sys
import time
import traceback
from pathlib import Path

from .config import DATA_DIR, DEVICE, RUNS_DIR, inside_data, rel
from .jobs import write_status
from .registry import load_model


def _num(v):
    try:
        f = float(v)
        return None if math.isnan(f) or math.isinf(f) else round(f, 5)
    except Exception:
        return None


def _data_arg(p: dict) -> str:
    # Datasets are built by the Node API under data/datasets/; never accept paths outside data/.
    return str(inside_data(p["data"]))


def run(job_dir: Path):
    p = json.loads((job_dir / "params.json").read_text())
    st = json.loads((job_dir / "status.json").read_text())
    st.update(state="running", started=time.time())
    write_status(job_dir, st)
    kind = p["kind"]

    if kind == "download":
        model = load_model(p["model"])
        st["result"] = {"model": p["model"], "task": model.task, "classes": len(model.names or {})}

    elif kind == "train":
        model = load_model(p["model"])
        st.update(epoch=0, epochs=int(p["epochs"]), batch_i=0, batches=0, history=[])
        last_write = [0.0]

        def save(force=False):
            now = time.time()
            if force or now - last_write[0] > 1.0:
                last_write[0] = now
                write_status(job_dir, st)

        def on_epoch_start(trainer):
            st["epoch"] = trainer.epoch + 1
            st["epochs"] = trainer.epochs
            st["batch_i"] = 0
            st["batches"] = len(trainer.train_loader)
            st["save_dir"] = rel(trainer.save_dir)
            save(True)

        def on_batch_end(trainer):
            st["batch_i"] += 1
            save()

        def on_fit_epoch_end(trainer):
            row = {"epoch": trainer.epoch + 1}
            try:
                row.update({k: _num(v) for k, v in trainer.label_loss_items(trainer.tloss, prefix="train").items()})
            except Exception:
                pass
            row.update({k: _num(v) for k, v in (trainer.metrics or {}).items()})
            # the final validation of best.pt fires this callback again for the last epoch
            h = st["history"]
            if h and (h[-1]["epoch"] == row["epoch"] or row["epoch"] > trainer.epochs):
                row["epoch"] = h[-1]["epoch"]
                h[-1] = row
            else:
                h.append(row)
            save(True)

        model.add_callback("on_train_epoch_start", on_epoch_start)
        model.add_callback("on_train_batch_end", on_batch_end)
        model.add_callback("on_fit_epoch_end", on_fit_epoch_end)

        model.train(
            data=_data_arg(p),
            epochs=int(p["epochs"]),
            imgsz=int(p.get("imgsz", 640)),
            batch=int(p.get("batch", 8)),
            patience=int(p.get("patience", 50)),
            workers=int(p.get("workers", 2)),
            device=DEVICE,
            project=str(RUNS_DIR),
            name=p.get("name") or "run",
            exist_ok=False,
            plots=True,
            verbose=False,
        )
        trainer = model.trainer
        st["save_dir"] = rel(trainer.save_dir)
        best = Path(trainer.best)
        st["result"] = {
            "best": rel(best) if best.exists() else None,
            "last": rel(trainer.last) if Path(trainer.last).exists() else None,
            "save_dir": rel(trainer.save_dir),
            "metrics": {k: _num(v) for k, v in (trainer.metrics or {}).items()},
        }

    elif kind == "val":
        model = load_model(p["model"])
        m = model.val(
            data=_data_arg(p),
            imgsz=int(p.get("imgsz", 640)),
            device=DEVICE,
            project=str(RUNS_DIR / "_val"),
            name=job_dir.name,
            plots=True,
            verbose=False,
        )
        st["result"] = {
            "metrics": {k: _num(v) for k, v in m.results_dict.items()},
            "speed": {k: _num(v) for k, v in (m.speed or {}).items()},
            "save_dir": rel(m.save_dir),
        }

    elif kind == "export":
        model = load_model(p["model"])
        fmt = p.get("format", "onnx")
        kw = dict(format=fmt, imgsz=int(p.get("imgsz", 640)), device=DEVICE)
        if fmt == "onnx":
            kw.update(simplify=True, dynamic=False, opset=int(p.get("opset", 17)))
        if p.get("int8"):
            kw["int8"] = True
        out = Path(model.export(**kw))
        st["result"] = {"path": rel(out), "format": fmt, "is_dir": out.is_dir()}

    st.update(state="done", finished=time.time())
    write_status(job_dir, st)


def main():
    job_dir = Path(sys.argv[1]).resolve()
    try:
        run(job_dir)
    except Exception as e:
        st = json.loads((job_dir / "status.json").read_text())
        st.update(state="failed", error=f"{type(e).__name__}: {e}", finished=time.time())
        write_status(job_dir, st)
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    print(f"data dir: {DATA_DIR}", flush=True)
    main()
