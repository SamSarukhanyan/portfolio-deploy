import { color } from "../draw";

/** Small multi-series line chart over epochs. */
export function Chart({ rows, keys, title }: { rows: Record<string, number | null>[]; keys: string[]; title: string }) {
  const W = 420;
  const H = 180;
  const P = { l: 40, r: 10, t: 10, b: 22 };
  const series = keys.filter((k) => rows.some((r) => r[k] != null));
  if (!series.length || rows.length < 1) return null;
  const vals = series.flatMap((k) => rows.map((r) => r[k]).filter((v): v is number => v != null));
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (hi - lo < 1e-6) {
    hi += 0.5;
    lo -= 0.5;
  }
  const n = rows.length;
  const x = (i: number) => P.l + (n === 1 ? (W - P.l - P.r) / 2 : (i / (n - 1)) * (W - P.l - P.r));
  const y = (v: number) => P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b);
  return (
    <figure className="chart">
      <figcaption>{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`}>
        {[0, 0.5, 1].map((f) => {
          const v = lo + f * (hi - lo);
          return (
            <g key={f}>
              <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} className="gridline" />
              <text x={P.l - 4} y={y(v) + 4} textAnchor="end" className="axis">
                {v.toFixed(v < 10 ? 3 : 1)}
              </text>
            </g>
          );
        })}
        <text x={W - P.r} y={H - 4} textAnchor="end" className="axis">
          эпоха {n}
        </text>
        {series.map((k, si) => (
          <polyline
            key={k}
            fill="none"
            stroke={color(si * 2 + 1)}
            strokeWidth={2}
            points={rows.map((r, i) => (r[k] == null ? null : `${x(i)},${y(r[k]!)}`)).filter(Boolean).join(" ")}
          />
        ))}
      </svg>
      <div className="legend">
        {series.map((k, si) => (
          <span key={k}>
            <span className="dot" style={{ background: color(si * 2 + 1) }} />
            {k.replace(/^metrics\//, "")} {rows.at(-1)?.[k]?.toFixed(3) ?? ""}
          </span>
        ))}
      </div>
    </figure>
  );
}
