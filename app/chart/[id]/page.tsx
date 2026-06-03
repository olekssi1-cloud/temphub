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
  y: number;
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

  if (!values.length) {
    return { min: 0, max: 30 };
  }

  const minRaw = Math.min(...values);
  const maxRaw = Math.max(...values);

  let min = Math.floor(minRaw - 2);
  let max = Math.ceil(maxRaw + 2);

  if (max - min < 5) {
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
    y: 0,
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
    const height = 430;
    const margin = { top: 24, right: 62, bottom: 54, left: 62 };

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

      const x = margin.left + (index / Math.max(points.length - 1, 1)) * innerWidth;

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
      y: 60,
    });
  }

  const tooltipPoint = points[tooltip.index];

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        color: "#0f172a",
        padding: 16,
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={topBarStyle}>
          <Link href="/" style={backStyle}>
            ‹
          </Link>

          <div style={{ textAlign: "center" }}>
            <h1 style={{ fontSize: 34, margin: 0 }}>Графік</h1>
            <div style={{ fontSize: 22, marginTop: 8 }}>
              {sensorNames[id] ?? `Сенсор ${id}`}
            </div>
          </div>

          <div style={themeButtonStyle}>☀️ 🌙</div>
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
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div style={cardGridStyle}>
          <div style={cardStyle("#dbeafe")}>
            <div style={{ fontSize: 18 }}>🌡 Температура</div>
            <div style={bigValueStyle}>{tempStats.last.toFixed(1)}°C</div>
            <div style={minMaxStyle}>
              Мін. {tempStats.min.toFixed(1)}°C
              <br />
              Макс. {tempStats.max.toFixed(1)}°C
            </div>
          </div>

          <div style={cardStyle("#dcfce7")}>
            <div style={{ fontSize: 18 }}>💧 Вологість</div>
            <div style={bigValueStyle}>{humidityStats.last.toFixed(1)}%</div>
            <div style={minMaxStyle}>
              Мін. {humidityStats.min.toFixed(1)}%
              <br />
              Макс. {humidityStats.max.toFixed(1)}%
            </div>
          </div>

          <div style={cardStyle("#ffedd5")}>
            <div style={{ fontSize: 18 }}>🌀 Двигун</div>
            <div style={bigValueStyle}>{motorCurrent}</div>
            <div style={minMaxStyle}>
              Мін. {motorStats.min.toFixed(0)}%
              <br />
              Макс. {motorStats.max.toFixed(0)}%
            </div>
          </div>
        </div>

        <div style={chartBoxStyle}>
          <div style={checkboxRowStyle}>
            <label>
              <input
                type="checkbox"
                checked={showTemp}
                onChange={(e) => setShowTemp(e.target.checked)}
              />{" "}
              Температура
            </label>

            <label>
              <input
                type="checkbox"
                checked={showHumidity}
                onChange={(e) => setShowHumidity(e.target.checked)}
              />{" "}
              Вологість
            </label>

            <label>
              <input
                type="checkbox"
                checked={showMotor}
                onChange={(e) => setShowMotor(e.target.checked)}
              />{" "}
              Двигун
            </label>
          </div>

          {loading ? (
            <div>Завантаження графіка...</div>
          ) : error ? (
            <div style={{ color: "red" }}>{error}</div>
          ) : points.length === 0 ? (
            <div>Немає даних для графіка за цей період</div>
          ) : (
            <svg
              ref={svgRef}
              width="100%"
              height="430"
              viewBox="0 0 900 430"
              onPointerDown={handlePointer}
              onPointerMove={(e) => tooltip.visible && handlePointer(e)}
              onPointerUp={() =>
                setTooltip((prev) => ({ ...prev, visible: false }))
              }
              onPointerLeave={() =>
                setTooltip((prev) => ({ ...prev, visible: false }))
              }
              style={{ touchAction: "none" }}
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
                  y={chart.height - 16}
                  fill="#64748b"
                  fontSize="13"
                  textAnchor="middle"
                >
                  {formatKyivTime(tick.label, period)}
                </text>
              ))}

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
                    x={Math.min(tooltip.x + 12, 650)}
                    y={tooltip.y}
                    width="235"
                    height="155"
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

const topBarStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 18,
};

const backStyle: CSSProperties = {
  color: "#0f172a",
  textDecoration: "none",
  fontSize: 34,
  fontWeight: 900,
};

const themeButtonStyle: CSSProperties = {
  width: 84,
  height: 44,
  borderRadius: 999,
  background: "#e5e7eb",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-around",
  fontSize: 24,
};

const periodGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 12,
  marginBottom: 16,
};

const periodButtonStyle: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: "14px 8px",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 18,
};

const cardGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 12,
  marginBottom: 16,
};

function cardStyle(borderColor: string): CSSProperties {
  return {
    background: "white",
    border: `1px solid ${borderColor}`,
    borderRadius: 18,
    padding: 14,
    minHeight: 130,
  };
}

const bigValueStyle: CSSProperties = {
  fontSize: 34,
  fontWeight: 900,
  marginTop: 16,
};

const minMaxStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 16,
  marginTop: 12,
  lineHeight: 1.5,
};

const chartBoxStyle: CSSProperties = {
  background: "white",
  borderRadius: 22,
  border: "1px solid #e5e7eb",
  padding: 14,
  marginBottom: 14,
};

const checkboxRowStyle: CSSProperties = {
  display: "flex",
  gap: 14,
  flexWrap: "wrap",
  marginBottom: 12,
  fontSize: 16,
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
  padding: "14px 6px",
  color: "#0f172a",
  textDecoration: "none",
  fontWeight: 800,
};