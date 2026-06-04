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
        item?.rpm === null || item?.rpm === undefined ? null : Number(item.rpm),
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

      if (thisTime - prevTime > 3 * 60 * 1000) started = false;
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

        if (!cancelled) setPoints(normalized);
      } catch {
        if (!cancelled) {
          setError("Не вдалося завантажити графік");
          setPoints([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
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
    const height = 360;
    const margin = { top: 18, right: 58, bottom: 38, left: 58 };

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
    const humidityPath = buildPath(points, "humidity", percentToY, width, margin);
    const motorPath = buildPath(points, "motorGraph", percentToY, width, margin);

    const xTicks = Array.from({ length: 5 }, (_, i) => {
      const index = Math.min(
        points.length - 1,
        Math.round((i / 4) * Math.max(points.length - 1, 0))
      );

      const x =
        margin.left + (index / Math.max(points.length - 1, 1)) * innerWidth;

      return { x, label: points[index]?.time ?? "" };
    });

    const tempTicks = Array.from({ length: 5 }, (_, i) =>
      Number((tempScale.min + (i / 4) * tempRange).toFixed(1))
    );

    return {
      width,
      height,
      margin,
      innerWidth,
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
      <div style={screenStyle}>
        <div style={topBarStyle}>
          <Link href="/" style={backStyle}>
            ‹
          </Link>

          <div style={{ textAlign: "center", minWidth: 0 }}>
            <h1 style={titleStyle}>Графік</h1>
            <div style={subtitleStyle}>{sensorNames[id] ?? `Сенсор ${id}`}</div>
          </div>

          <button type="button" style={themeButtonStyle}>
            ☀️🌙
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
            <div style={metricTitleStyle}>🌡 Темп.</div>
            <div style={{ ...metricValueStyle, color: "#0284c7" }}>
              {tempStats.last.toFixed(1)}°
            </div>
            <div style={metricSmallStyle}>
              {tempStats.min.toFixed(1)} / {tempStats.max.toFixed(1)}
            </div>
          </div>

          <div style={metricCardStyle("#dcfce7")}>
            <div style={metricTitleStyle}>💧 Волог.</div>
            <div style={{ ...metricValueStyle, color: "#16a34a" }}>
              {humidityStats.last.toFixed(1)}%
            </div>
            <div style={metricSmallStyle}>
              {humidityStats.min.toFixed(1)} / {humidityStats.max.toFixed(1)}
            </div>
          </div>

          <div style={metricCardStyle("#ffedd5")}>
            <div style={metricTitleStyle}>🌀 Двигун</div>
            <div style={{ ...metricValueStyle, color: "#ea580c" }}>
              {motorCurrent}
            </div>
            <div style={metricSmallStyle}>
              {motorStats.min.toFixed(0)} / {motorStats.max.toFixed(0)}%
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
              />
              Температура
            </label>

            <label style={{ ...checkLabelStyle, color: "#16a34a" }}>
              <input
                type="checkbox"
                checked={showHumidity}
                onChange={(e) => setShowHumidity(e.target.checked)}
              />
              Вологість
            </label>

            <label style={{ ...checkLabelStyle, color: "#ea580c" }}>
              <input
                type="checkbox"
                checked={showMotor}
                onChange={(e) => setShowMotor(e.target.checked)}
              />
              Двигун
            </label>
          </div>

          <div style={chartAreaStyle}>
            {loading ? (
              <div style={emptyStyle}>Завантаження...</div>
            ) : error ? (
              <div style={{ ...emptyStyle, color: "red" }}>{error}</div>
            ) : points.length === 0 ? (
              <div style={emptyStyle}>Немає даних</div>
            ) : (
              <svg
                ref={svgRef}
                width="100%"
                height="100%"
                viewBox="0 0 900 360"
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
                        x={chart.width - chart.margin.right + 10}
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
                      x={chart.margin.left - 8}
                      y={y + 4}
                      fill="#64748b"
                      fontSize="13"
                      textAnchor="end"
                    >
                      {tick}°
                    </text>
                  );
                })}

                {chart.xTicks.map((tick, index) => (
                  <text
                    key={index}
                    x={tick.x}
                    y={chart.height - 10}
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
                      x={Math.min(tooltip.x + 12, 635)}
                      y={24}
                      width="250"
                      height="145"
                    >
                      <div style={tooltipStyle}>
                        <div style={{ fontWeight: 900, marginBottom: 6 }}>
                          {formatKyivDateTime(tooltipPoint.time)}
                        </div>

                        {showTemp && (
                          <div>🌡 {tooltipPoint.temp?.toFixed(1)}°C</div>
                        )}

                        {showHumidity && (
                          <div>💧 {tooltipPoint.humidity?.toFixed(1)}%</div>
                        )}

                        {showMotor && (
                          <div>
                            🌀{" "}
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
        </div>

        <div style={motorHintStyle}>
          🟠 Двигун: авто — реальний %, ручне — пунктир
        </div>

        <div style={navBoxStyle}>
          <Link href={`/chart/${id}`} style={navStyle}>
            📈<br />Графік
          </Link>

          <Link href={`/disconnects/${id}`} style={navStyle}>
            ⚡<br />Відключення
          </Link>

          <Link href={`/fan-settings/${id}`} style={navStyle}>
            ⚙️<br />Керування
          </Link>
        </div>
      </div>
    </main>
  );
}

const pageStyle: CSSProperties = {
  height: "100dvh",
  overflow: "hidden",
  background: "#f1f5f9",
  color: "#0f172a",
};

const screenStyle: CSSProperties = {
  height: "100dvh",
  maxWidth: 560,
  margin: "0 auto",
  padding: "8px 10px",
  display: "flex",
  flexDirection: "column",
  gap: 7,
};

const topBarStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "36px 1fr 70px",
  alignItems: "center",
  minHeight: 45,
};

const backStyle: CSSProperties = {
  color: "#0f172a",
  textDecoration: "none",
  fontSize: 34,
  fontWeight: 900,
  lineHeight: 1,
};

const titleStyle: CSSProperties = {
  fontSize: "clamp(22px, 5vw, 30px)",
  margin: 0,
  fontWeight: 950,
  lineHeight: 1,
};

const subtitleStyle: CSSProperties = {
  fontSize: "clamp(14px, 3.6vw, 20px)",
  marginTop: 3,
  color: "#64748b",
  lineHeight: 1,
};

const themeButtonStyle: CSSProperties = {
  width: 70,
  height: 34,
  borderRadius: 999,
  background: "white",
  border: "1px solid #e5e7eb",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 18,
};

const periodGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 7,
};

const periodButtonStyle: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: "9px 4px",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: "clamp(13px, 3.5vw, 16px)",
};

const cardGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 7,
};

function metricCardStyle(borderColor: string): CSSProperties {
  return {
    background: "white",
    border: `1px solid ${borderColor}`,
    borderRadius: 14,
    padding: "8px 6px",
    minHeight: 82,
    boxShadow: "0 6px 16px rgba(15,23,42,0.05)",
    overflow: "hidden",
  };
}

const metricTitleStyle: CSSProperties = {
  fontSize: "clamp(11px, 3vw, 14px)",
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const metricValueStyle: CSSProperties = {
  fontSize: "clamp(20px, 6vw, 28px)",
  fontWeight: 950,
  marginTop: 7,
  lineHeight: 1,
};

const metricSmallStyle: CSSProperties = {
  color: "#64748b",
  fontSize: "clamp(10px, 2.8vw, 13px)",
  marginTop: 7,
  lineHeight: 1.2,
  whiteSpace: "nowrap",
};

const chartBoxStyle: CSSProperties = {
  background: "white",
  borderRadius: 18,
  border: "1px solid #e5e7eb",
  padding: 8,
  boxShadow: "0 8px 22px rgba(15,23,42,0.07)",
  flex: "1 1 auto",
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
};

const checkboxRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  gap: 10,
  flexWrap: "wrap",
  marginBottom: 4,
  fontSize: "clamp(11px, 3vw, 14px)",
  fontWeight: 900,
  flex: "0 0 auto",
};

const checkLabelStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 3,
};

const chartAreaStyle: CSSProperties = {
  flex: "1 1 auto",
  minHeight: 0,
};

const emptyStyle: CSSProperties = {
  padding: 20,
  color: "#64748b",
  fontWeight: 700,
};

const tooltipStyle: CSSProperties = {
  background: "white",
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: 10,
  boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
  fontSize: 13,
  lineHeight: 1.45,
};

const motorHintStyle: CSSProperties = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: "7px 10px",
  fontSize: "clamp(11px, 3vw, 14px)",
  color: "#64748b",
  fontWeight: 800,
  textAlign: "center",
  flex: "0 0 auto",
};

const navBoxStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 6,
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  overflow: "hidden",
  flex: "0 0 auto",
};

const navStyle: CSSProperties = {
  textAlign: "center",
  padding: "9px 4px",
  color: "#0f172a",
  textDecoration: "none",
  fontWeight: 900,
  fontSize: "clamp(11px, 3vw, 14px)",
};