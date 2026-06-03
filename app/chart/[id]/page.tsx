"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent } from "react";

type PeriodKey = "12h" | "1d" | "3d";

type HistoryPoint = {
  temp: number | null;
  humidity: number | null;
  rpm: number | null;
  mode: "auto" | "manual";
  motorGraph: number | null;
  time: string;
};

type TooltipState = {
  visible: boolean;
  index: number;
  x: number;
};

const periods: { key: PeriodKey; label: string }[] = [
  { key: "12h", label: "12 год" },
  { key: "1d", label: "1 день" },
  { key: "3d", label: "3 дні" },
];

const sensorNames: Record<string, string> = {
  "1": "Опорос",
  "2": "Супорос 1",
  "3": "Супорос 2",
  "4": "Супорос 3",
  "5": "Відгодівля",
  "6": "Карантин",
  "7": "Подвір'я",
};

function normalizeHistory(input: unknown): HistoryPoint[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((item: any) => ({
      temp:
        item?.temp === null || item?.temp === undefined
          ? null
          : Number(item.temp),
      humidity:
        item?.humidity === null || item?.humidity === undefined
          ? null
          : Number(item.humidity),
      rpm:
        item?.rpm === null || item?.rpm === undefined
          ? null
          : Number(item.rpm),
      mode: (item?.mode === "manual" ? "manual" : "auto") as
        | "auto"
        | "manual",
      motorGraph:
        item?.motorGraph === null || item?.motorGraph === undefined
          ? null
          : Number(item.motorGraph),
      time: String(item?.time ?? ""),
    }))
    .filter((item) => item.time);
}

function formatKyivTime(dateString: string, period: PeriodKey) {
  const date = new Date(dateString);

  if (period === "3d") {
    return new Intl.DateTimeFormat("uk-UA", {
      timeZone: "Europe/Kyiv",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  return new Intl.DateTimeFormat("uk-UA", {
    timeZone: "Europe/Kyiv",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatKyivDateTime(dateString: string) {
  return new Intl.DateTimeFormat("uk-UA", {
    timeZone: "Europe/Kyiv",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(dateString));
}

function minMax(values: Array<number | null>) {
  const nums = values.filter(
    (v): v is number => typeof v === "number" && !Number.isNaN(v)
  );

  return {
    min: nums.length ? Math.min(...nums) : 0,
    max: nums.length ? Math.max(...nums) : 0,
    last: nums.length ? nums[nums.length - 1] : 0,
  };
}

function getTempScale(points: HistoryPoint[]) {
  const values = points
    .map((p) => p.temp)
    .filter((v): v is number => typeof v === "number" && !Number.isNaN(v));

  if (!values.length) return { min: 0, max: 30 };

  const minRaw = Math.min(...values);
  const maxRaw = Math.max(...values);

  let min = Math.floor(minRaw - 2);
  let max = Math.ceil(maxRaw + 2);

  if (max - min < 6) {
    const middle = (max + min) / 2;
    min = Math.floor(middle - 3);
    max = Math.ceil(middle + 3);
  }

  return { min, max };
}

function buildPath(
  points: HistoryPoint[],
  key: "temp" | "humidity" | "motorGraph",
  valueToY: (value: number) => number,
  width: number,
  margin: { top: number; right: number; bottom: number; left: number }
) {
  const innerWidth = width - margin.left - margin.right;

  let path = "";
  let started = false;

  points.forEach((point, index) => {
    const value = point[key];

    if (value === null || value === undefined || Number.isNaN(value)) {
      started = false;
      return;
    }

    if (index > 0) {
      const prevTime = new Date(points[index - 1].time).getTime();
      const thisTime = new Date(point.time).getTime();

      if (thisTime - prevTime > 3 * 60 * 1000) {
        started = false;
      }
    }

    const x =
      margin.left + (index / Math.max(points.length - 1, 1)) * innerWidth;

    const y = valueToY(value);

    path += `${started ? " L" : " M"}${x.toFixed(2)},${y.toFixed(2)}`;
    started = true;
  });

  return path.trim();
}

export default function ChartPage() {
  const params = useParams();
  const id = String(params?.id ?? "1");

  const svgRef = useRef<SVGSVGElement | null>(null);

  const [period, setPeriod] = useState<PeriodKey>("12h");
  const [points, setPoints] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showTemp, setShowTemp] = useState(true);
  const [showHumidity, setShowHumidity] = useState(true);
  const [showMotor, setShowMotor] = useState(true);

  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    index: 0,
    x: 0,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`/api/history?device_id=${id}&range=${period}`, {
          cache: "no-store",
        });

        const json = await res.json();
        const normalized = normalizeHistory(json);

        if (!cancelled) {
          setPoints(normalized);
        }
      } catch {
        if (!cancelled) {
          setError("Не вдалося завантажити графік");
          setPoints([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadHistory();
    const timer = setInterval(loadHistory, 60000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [id, period]);

  const tempStats = useMemo(() => minMax(points.map((p) => p.temp)), [points]);
  const humidityStats = useMemo(
    () => minMax(points.map((p) => p.humidity)),
    [points]
  );
  const motorStats = useMemo(
    () => minMax(points.map((p) => p.motorGraph)),
    [points]
  );

  const lastPoint = points.length ? points[points.length - 1] : null;

  const motorCurrent =
    lastPoint?.mode === "manual"
      ? "Ручне"
      : `${Math.round(lastPoint?.rpm ?? 0)}%`;

  const chart = useMemo(() => {
    const width = 900;
    const height = 500;
    const margin = { top: 28, right: 64, bottom: 54, left: 64 };

    const innerHeight = height - margin.top - margin.bottom;
    const innerWidth = width - margin.left - margin.right;

    const tempScale = getTempScale(points);
    const tempRange = tempScale.max - tempScale.min || 1;

    const tempToY = (value: number) =>
      margin.top +
      innerHeight -
      ((value - tempScale.min) / tempRange) * innerHeight;

    const percentToY = (value: number) =>
      margin.top + innerHeight - (value / 100) * innerHeight;

    const tempPath = buildPath(points, "temp", tempToY, width, margin);
    const humidityPath = buildPath(
      points,
      "humidity",
      percentToY,
      width,
      margin
    );
    const motorPath = buildPath(points, "motorGraph", percentToY, width, margin);

    const xTicks = Array.from({ length: 5 }, (_, i) => {
      const index = Math.min(
        points.length - 1,
        Math.round((i / 4) * Math.max(points.length - 1, 0))
      );

      const x =
        margin.left + (index / Math.max(points.length - 1, 1)) * innerWidth;

      return {
        x,
        label: points[index]?.time ?? "",
      };
    });

    const tempTicks = Array.from({ length: 5 }, (_, i) =>
      Number((tempScale.min + (i / 4) * tempRange).toFixed(1))
    );

    return {
      width,
      height,
      margin,
      innerWidth,
      innerHeight,
      tempScale,
      tempToY,
      percentToY,
      tempPath,
      humidityPath,
      motorPath,
      xTicks,
      tempTicks,
      percentTicks: [0, 25, 50, 75, 100],
    };
  }, [points]);

  function handlePointer(event: PointerEvent<SVGSVGElement>) {
    if (!svgRef.current || !points.length) return;

    const rect = svgRef.current.getBoundingClientRect();
    const xPx = event.clientX - rect.left;
    const viewX = (xPx / rect.width) * chart.width;

    const startX = chart.margin.left;
    const endX = chart.width - chart.margin.right;
    const clampedX = Math.max(startX, Math.min(endX, viewX));

    const ratio = (clampedX - startX) / Math.max(chart.innerWidth, 1);
    const index = Math.round(ratio * (points.length - 1));

    setTooltip({
      visible: true,
      index: Math.max(0, Math.min(points.length - 1, index)),
      x: clampedX,
    });
  }

  const tooltipPoint = points[tooltip.index];

  return (
    <main style={pageStyle}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={topBarStyle}>
          <Link href="/" style={backStyle}>
            ‹
          </Link>

          <div style={{ textAlign: "center" }}>
            <h1 style={{ fontSize: 32, margin: 0, fontWeight: 950 }}>
              Графік
            </h1>
            <div style={{ fontSize: 20, marginTop: 4, color: "#64748b" }}>
              {sensorNames[id] ?? `Сенсор ${id}`}
            </div>
          </div>

          <button type="button" style={themeButtonStyle}>
            ☀️ 🌙
          </button>
        </div>

        <div style={periodGridStyle}>
          {periods.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              style={{
                ...periodButtonStyle,
                background:
                  period === p.key
                    ? "linear-gradient(135deg,#7c3aed,#6d28d9)"
                    : "white",
                color: period === p.key ? "white" : "#0f172a",
                borderColor: period === p.key ? "#7c3aed" : "#e5e7eb",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div style={cardGridStyle}>
          <div style={metricCardStyle("#dbeafe")}>
            <div style={metricTitleStyle}>🌡 Температура</div>
            <div style={{ ...metricValueStyle, color: "#0284c7" }}>
              {tempStats.last.toFixed(1)}°C
            </div>
            <div style={metricSmallStyle}>
              Мін. {tempStats.min.toFixed(1)}°C
              <br />
              Макс. {tempStats.max.toFixed(1)}°C
            </div>
          </div>

          <div style={metricCardStyle("#dcfce7")}>
            <div style={metricTitleStyle}>💧 Вологість</div>
            <div style={{ ...metricValueStyle, color: "#16a34a" }}>
              {humidityStats.last.toFixed(1)}%
            </div>
            <div style={metricSmallStyle}>
              Мін. {humidityStats.min.toFixed(1)}%
              <br />
              Макс. {humidityStats.max.toFixed(1)}%
            </div>
          </div>

          <div style={metricCardStyle("#ffedd5")}>
            <div style={metricTitleStyle}>🌀 Двигун</div>
            <div style={{ ...metricValueStyle, color: "#ea580c" }}>
              {motorCurrent}
            </div>
            <div style={metricSmallStyle}>
              Мін. {motorStats.min.toFixed(0)}%
              <br />
              Макс. {motorStats.max.toFixed(0)}%
            </div>
          </div>
        </div>

        <div style={chartBoxStyle}>
          <div style={checkboxRowStyle}>
            <label style={{ ...checkLabelStyle, color: "#0284c7" }}>
              <input
                type="checkbox"
                checked={showTemp}
                onChange={(e) => setShowTemp(e.target.checked)}
              />{" "}
              Температура
            </label>

            <label style={{ ...checkLabelStyle, color: "#16a34a" }}>
              <input
                type="checkbox"
                checked={showHumidity}
                onChange={(e) => setShowHumidity(e.target.checked)}
              />{" "}
              Вологість
            </label>

            <label style={{ ...checkLabelStyle, color: "#ea580c" }}>
              <input
                type="checkbox"
                checked={showMotor}
                onChange={(e) => setShowMotor(e.target.checked)}
              />{" "}
              Двигун
            </label>
          </div>

          {loading ? (
            <div style={emptyStyle}>Завантаження графіка...</div>
          ) : error ? (
            <div style={{ ...emptyStyle, color: "red" }}>{error}</div>
          ) : points.length === 0 ? (
            <div style={emptyStyle}>Немає даних для графіка за цей період</div>
          ) : (
            <svg
              ref={svgRef}
              width="100%"
              height="500"
              viewBox="0 0 900 500"
              onPointerDown={handlePointer}
              onPointerMove={(e) => tooltip.visible && handlePointer(e)}
              onPointerUp={() =>
                setTooltip((prev) => ({ ...prev, visible: false }))
              }
              onPointerLeave={() =>
                setTooltip((prev) => ({ ...prev, visible: false }))
              }
              style={{ touchAction: "none", display: "block" }}
            >
              {chart.percentTicks.map((tick) => {
                const y = chart.percentToY(tick);

                return (
                  <g key={`p-${tick}`}>
                    <line
                      x1={chart.margin.left}
                      y1={y}
                      x2={chart.width - chart.margin.right}
                      y2={y}
                      stroke="#e5e7eb"
                    />
                    <text
                      x={chart.width - chart.margin.right + 12}
                      y={y + 4}
                      fill="#64748b"
                      fontSize="13"
                    >
                      {tick}%
                    </text>
                  </g>
                );
              })}

              {chart.tempTicks.map((tick) => {
                const y = chart.tempToY(tick);

                return (
                  <text
                    key={`t-${tick}`}
                    x={chart.margin.left - 10}
                    y={y + 4}
                    fill="#64748b"
                    fontSize="13"
                    textAnchor="end"
                  >
                    {tick}°C
                  </text>
                );
              })}

              {chart.xTicks.map((tick, index) => (
                <text
                  key={index}
                  x={tick.x}
                  y={chart.height - 18}
                  fill="#64748b"
                  fontSize="13"
                  textAnchor="middle"
                >
                  {formatKyivTime(tick.label, period)}
                </text>
              ))}

              <line
                x1={chart.margin.left}
                y1={chart.margin.top}
                x2={chart.margin.left}
                y2={chart.height - chart.margin.bottom}
                stroke="#cbd5e1"
                strokeWidth="1.5"
              />

              <line
                x1={chart.width - chart.margin.right}
                y1={chart.margin.top}
                x2={chart.width - chart.margin.right}
                y2={chart.height - chart.margin.bottom}
                stroke="#cbd5e1"
                strokeWidth="1.5"
              />

              {showTemp && (
                <path
                  d={chart.tempPath}
                  fill="none"
                  stroke="#0ea5e9"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {showHumidity && (
                <path
                  d={chart.humidityPath}
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {showMotor && (
                <path
                  d={chart.motorPath}
                  fill="none"
                  stroke="#f97316"
                  strokeWidth="4"
                  strokeDasharray="8 8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {tooltip.visible && tooltipPoint && (
                <>
                  <line
                    x1={tooltip.x}
                    y1={chart.margin.top}
                    x2={tooltip.x}
                    y2={chart.height - chart.margin.bottom}
                    stroke="#334155"
                    strokeDasharray="5 5"
                    strokeWidth="2"
                  />

                  <foreignObject
                    x={Math.min(tooltip.x + 12, 640)}
                    y={42}
                    width="245"
                    height="165"
                  >
                    <div style={tooltipStyle}>
                      <div style={{ fontWeight: 900, marginBottom: 8 }}>
                        {formatKyivDateTime(tooltipPoint.time)}
                      </div>

                      {showTemp && (
                        <div>🌡 Темп: {tooltipPoint.temp?.toFixed(1)}°C</div>
                      )}

                      {showHumidity && (
                        <div>
                          💧 Вологість: {tooltipPoint.humidity?.toFixed(1)}%
                        </div>
                      )}

                      {showMotor && (
                        <div>
                          🌀 Двигун:{" "}
                          {tooltipPoint.mode === "manual"
                            ? "Ручне"
                            : `${Math.round(tooltipPoint.rpm ?? 0)}%`}
                        </div>
                      )}
                    </div>
                  </foreignObject>
                </>
              )}
            </svg>
          )}
        </div>

        <div style={navBoxStyle}>
          <Link href={`/chart/${id}`} style={navStyle}>
            📈
            <br />
            Графік
          </Link>

          <Link href={`/disconnects/${id}`} style={navStyle}>
            ⚡
            <br />
            Відключення
          </Link>

          <Link href={`/fan-settings/${id}`} style={navStyle}>
            ⚙️
            <br />
            Керування
          </Link>
        </div>
      </div>
    </main>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "#f1f5f9",
  color: "#0f172a",
  padding: 14,
};

const topBarStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "48px 1fr 84px",
  alignItems: "center",
  marginBottom: 14,
};

const backStyle: CSSProperties = {
  color: "#0f172a",
  textDecoration: "none",
  fontSize: 38,
  fontWeight: 900,
  lineHeight: 1,
};

const themeButtonStyle: CSSProperties = {
  width: 84,
  height: 42,
  borderRadius: 999,
  background: "white",
  border: "1px solid #e5e7eb",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-around",
  fontSize: 22,
};

const periodGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 10,
  marginBottom: 12,
};

const periodButtonStyle: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: "12px 8px",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 17,
};

const cardGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 10,
  marginBottom: 12,
};

function metricCardStyle(borderColor: string): CSSProperties {
  return {
    background: "white",
    border: `1px solid ${borderColor}`,
    borderRadius: 18,
    padding: 12,
    minHeight: 112,
    boxShadow: "0 8px 20px rgba(15,23,42,0.05)",
  };
}

const metricTitleStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 800,
};

const metricValueStyle: CSSProperties = {
  fontSize: 29,
  fontWeight: 950,
  marginTop: 12,
};

const metricSmallStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 14,
  marginTop: 8,
  lineHeight: 1.45,
};

const chartBoxStyle: CSSProperties = {
  background: "white",
  borderRadius: 24,
  border: "1px solid #e5e7eb",
  padding: 12,
  marginBottom: 12,
  boxShadow: "0 10px 26px rgba(15,23,42,0.07)",
};

const checkboxRowStyle: CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 6,
  fontSize: 15,
  fontWeight: 900,
};

const checkLabelStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
};

const emptyStyle: CSSProperties = {
  padding: 20,
  color: "#64748b",
  fontWeight: 700,
};

const tooltipStyle: CSSProperties = {
  background: "white",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  padding: 12,
  boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
  fontSize: 14,
  lineHeight: 1.5,
};

const navBoxStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 8,
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  overflow: "hidden",
};

const navStyle: CSSProperties = {
  textAlign: "center",
  padding: "13px 6px",
  color: "#0f172a",
  textDecoration: "none",
  fontWeight: 900,
};