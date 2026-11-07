import { useCallback, useEffect, useState } from "react";
import { get, store } from "./api";
import { Datasets } from "./pages/Datasets";
import { Live } from "./pages/Live";
import { Models } from "./pages/Models";
import { System } from "./pages/System";
import { Training } from "./pages/Training";
import type { ModelInfo, OnnxModel } from "./types";

const TABS = [
  ["live", "Камера"],
  ["datasets", "Датасеты"],
  ["training", "Обучение"],
  ["models", "Модели"],
  ["system", "Система"],
] as const;
type Tab = (typeof TABS)[number][0];

export function App() {
  const [tab, setTab] = useState<Tab>(() => store.get("tab", "live"));
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [onnx, setOnnx] = useState<OnnxModel[]>([]);
  const [visionDown, setVisionDown] = useState(false);
  const [liveModel, setLiveModel] = useState<{ id: string; n: number } | null>(null);

  useEffect(() => store.set("tab", tab), [tab]);

  const reload = useCallback(() => {
    get<{ models: ModelInfo[]; onnx: OnnxModel[] }>("/vision/models")
      .then((r) => {
        setModels(r.models);
        setOnnx(r.onnx);
        setVisionDown(false);
      })
      .catch(() => setVisionDown(true));
  }, []);
  useEffect(reload, [reload]);

  const useInCamera = (id: string) => {
    setLiveModel((p) => ({ id, n: (p?.n ?? 0) + 1 }));
    setTab("live");
  };

  return (
    <div className="app">
      <header>
        <b className="logo">YOLO Studio</b>
        <span className="muted small">dev · Ultralytics</span>
        <nav>
          {TABS.map(([id, label]) => (
            <button key={id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </nav>
        {visionDown && (
          <span className="err small">
            Python vision-сервис не отвечает — <button onClick={reload}>повторить</button>
          </span>
        )}
      </header>
      {/* Live stays mounted so the camera keeps running while you label or train */}
      <div hidden={tab !== "live"}>
        <Live models={models} onnx={onnx} liveModel={liveModel} />
      </div>
      {tab === "datasets" && <Datasets models={models} />}
      {tab === "training" && <Training models={models} onUse={useInCamera} onModelsChanged={reload} />}
      {tab === "models" && <Models models={models} onnx={onnx} reload={reload} onUse={useInCamera} />}
      {tab === "system" && <System />}
    </div>
  );
}
