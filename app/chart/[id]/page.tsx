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


const zoomButtons = [
  { label: "Весь", minutes: null },
  { label: "6 год", minutes: 360 },
  { label: "3 год", minutes: 180 },
  { label: "1 год", minutes: 60 },
  { label: "30 хв", minutes: 30 },
  { label: "10 хв", minutes: 10 },
  { label: "5 хв", minutes: 5 },
];

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

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

  const [zoomMinutes, setZoomMinutes] = useState<number | null>(null);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [panPercent, setPanPercent] = useState(100);

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

  useEffect(() => {
    setZoomMinutes(null);
    setZoomPercent(100);
    setPanPercent(100);
  }, [period]);

  const timeInfo = useMemo(() => {
    if (points.length < 2) {
      return { firstMs: 0, lastMs: 0, totalMinutes: 0 };
    }

    const firstMs = new Date(points[0].time).getTime();
    const lastMs = new Date(points[points.length - 1].time).getTime();
    const totalMinutes = Math.max(1, (lastMs - firstMs) / 60000);

    return { firstMs, lastMs, totalMinutes };
  }, [points]);

  const activeZoomMinutes = useMemo(() => {
    if (!points.length || timeInfo.totalMinutes <= 0) return null;
    if (zoomMinutes !== null) return Math.min(zoomMinutes, timeInfo.totalMinutes);

    const minMinutes = Math.min(5, timeInfo.totalMinutes);
    const percent = clampNumber(zoomPercent, 0, 100);

    if (percent >= 99) return null;

    const ratio = percent / 100;
    return minMinutes + (timeInfo.totalMinutes - minMinutes) * ratio;
  }, [points.length, timeInfo.totalMinutes, zoomMinutes, zoomPercent]);

  const visiblePoints = useMemo(() => {
    if (!points.length || !activeZoomMinutes || activeZoomMinutes >= timeInfo.totalMinutes) {
      return points;
    }

    const windowMs = activeZoomMinutes * 60000;
    const availableMs = Math.max(0, timeInfo.lastMs - timeInfo.firstMs - windowMs);
    const startMs = timeInfo.firstMs + availableMs * (clampNumber(panPercent, 0, 100) / 100);
    const endMs = startMs + windowMs;

    const filtered = points.filter((p) => {
      const t = new Date(p.time).getTime();
      return t >= startMs && t <= endMs;
    });

    return filtered.length >= 2 ? filtered : points.slice(-2);
  }, [points, activeZoomMinutes, timeInfo, panPercent]);

  const zoomLabel = useMemo(() => {
    if (!activeZoomMinutes || activeZoomMinutes >= timeInfo.totalMinutes) return "Весь діапазон";

    if (activeZoomMinutes >= 60) {
      const hours = Math.floor(activeZoomMinutes / 60);
      const minutes = Math.round(activeZoomMinutes % 60);
      return minutes > 0 ? `${hours} год ${minutes} хв` : `${hours} год`;
    }

    return `${Math.round(activeZoomMinutes)} хв`;
  }, [activeZoomMinutes, timeInfo.totalMinutes]);

  const tempStats = useMemo(() => minMax(visiblePoints.map((p) => p.temp)), [visiblePoints]);
  const humidityStats = useMemo(
    () => minMax(visiblePoints.map((p) => p.humidity)),
    [visiblePoints]
  );
  const motorStats = useMemo(
    () => minMax(visiblePoints.map((p) => p.motorGraph)),
    [visiblePoints]
  );

  const lastPoint = points.length ? points[points.length - 1] : null;

  const motorCurrent =
    lastPoint?.mode === "manual"
      ? "Ручне"
      : `${Math.round(lastPoint?.rpm ?? 0)}%`;

  const chart = useMemo(() => {
    const width = 900;
    const height = 500;
    const margin = { top: 26, right: 64, bottom: 52, left: 64 };

    const innerHeight = height - margin.top - margin.bottom;
    const innerWidth = width - margin.left - margin.right;

    const tempScale = getTempScale(visiblePoints);
    const tempRange = tempScale.max - tempScale.min || 1;

    const tempToY = (value: number) =>
      margin.top +
      innerHeight -
      ((value - tempScale.min) / tempRange) * innerHeight;

    const percentToY = (value: number) =>
      margin.top + innerHeight - (value / 100) * innerHeight;

    const tempPath = buildPath(visiblePoints, "temp", tempToY, width, margin);
    const humidityPath = buildPath(visiblePoints, "humidity", percentToY, width, margin);
    const motorPath = buildPath(visiblePoints, "motorGraph", percentToY, width, margin);

    const xTicks = Array.from({ length: 5 }, (_, i) => {
      const index = Math.min(
        visiblePoints.length - 1,
        Math.round((i / 4) * Math.max(visiblePoints.length - 1, 0))
      );

      const x =
        margin.left + (index / Math.max(visiblePoints.length - 1, 1)) * innerWidth;

      return { x, label: visiblePoints[index]?.time ?? "" };
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
  }, [visiblePoints]);

  function handlePointer(event: PointerEvent<SVGSVGElement>) {
    if (!svgRef.current || !visiblePoints.length) return;

    const rect = svgRef.current.getBoundingClientRect();
    const xPx = event.clientX - rect.left;
    const viewX = (xPx / rect.width) * chart.width;

    const startX = chart.margin.left;
    const endX = chart.width - chart.margin.right;
    const clampedX = Math.max(startX, Math.min(endX, viewX));

    const ratio = (clampedX - startX) / Math.max(chart.innerWidth, 1);
    const index = Math.round(ratio * (visiblePoints.length - 1));

    setTooltip({
      visible: true,
      index: Math.max(0, Math.min(visiblePoints.length - 1, index)),
      x: clampedX,
    });
  }

  const tooltipPoint = visiblePoints[tooltip.index];

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

          <div style={zoomPanelStyle}>
            <div style={zoomButtonsStyle}>
              {zoomButtons.map((button) => {
                const active =
                  (button.minutes === null && activeZoomMinutes === null) ||
                  (button.minutes !== null &&
                    activeZoomMinutes !== null &&
                    Math.abs(activeZoomMinutes - button.minutes) < 1);

                return (
                  <button
                    key={button.label}
                    type="button"
                    onClick={() => {
                      setZoomMinutes(button.minutes);
                      setPanPercent(100);
                      if (button.minutes === null) setZoomPercent(100);
                    }}
                    style={{
                      ...zoomButtonStyle,
                      background: active ? "#0f172a" : "#f8fafc",
                      color: active ? "white" : "#0f172a",
                      borderColor: active ? "#0f172a" : "#e5e7eb",
                    }}
                  >
                    {button.label}
                  </button>
                );
              })}
            </div>

            <div style={sliderRowStyle}>
              <span style={sliderLabelStyle}>Масштаб</span>
              <input
                type="range"
                min="0"
                max="100"
                value={zoomMinutes === null ? zoomPercent : 100}
                onChange={(e) => {
                  setZoomMinutes(null);
                  setZoomPercent(Number(e.target.value));
                }}
                style={rangeStyle}
              />
              <b style={zoomValueStyle}>{zoomLabel}</b>
            </div>

            <div style={sliderRowStyle}>
              <span style={sliderLabelStyle}>Позиція</span>
              <input
                type="range"
                min="0"
                max="100"
                value={panPercent}
                onChange={(e) => setPanPercent(Number(e.target.value))}
                disabled={!activeZoomMinutes || activeZoomMinutes >= timeInfo.totalMinutes}
                style={rangeStyle}
              />
              <button
                type="button"
                onClick={() => {
                  setZoomMinutes(null);
                  setZoomPercent(100);
                  setPanPercent(100);
                }}
                style={resetZoomButtonStyle}
              >
                Скинути
              </button>
            </div>
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
                viewBox="0 0 900 500"
                preserveAspectRatio="none"
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
  x={tooltip.x > 560 ? tooltip.x - 300 : tooltip.x + 16}
  y={36}
  width="280"
  height="190"
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
    minHeight: 68,
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


const zoomPanelStyle: CSSProperties = {
  background: "#f8fafc",
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: "7px",
  marginBottom: 6,
  flex: "0 0 auto",
};

const zoomButtonsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(7, 1fr)",
  gap: 4,
  marginBottom: 7,
};

const zoomButtonStyle: CSSProperties = {
  border: "1px solid",
  borderRadius: 9,
  padding: "6px 2px",
  fontSize: "clamp(9px, 2.5vw, 12px)",
  fontWeight: 900,
};

const sliderRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "58px 1fr 72px",
  alignItems: "center",
  gap: 6,
  marginTop: 4,
};

const sliderLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  color: "#475569",
};

const rangeStyle: CSSProperties = {
  width: "100%",
  accentColor: "#7c3aed",
};

const zoomValueStyle: CSSProperties = {
  fontSize: 11,
  textAlign: "right",
  color: "#0f172a",
};

const resetZoomButtonStyle: CSSProperties = {
  border: 0,
  borderRadius: 9,
  background: "#7c3aed",
  color: "white",
  padding: "6px 4px",
  fontSize: 11,
  fontWeight: 900,
};

const chartAreaStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  height: "100%",
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