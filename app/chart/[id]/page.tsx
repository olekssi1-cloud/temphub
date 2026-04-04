"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type PeriodKey = "1h" | "10h" | "24h" | "3d";

type HistoryPoint = {
  temp: number;
  time: string;
};

type HoveredPoint = {
  x: number;
  y: number;
  temp: number;
  time: string;
};

const periods: { key: PeriodKey; label: string }[] = [
  { key: "1h", label: "1 година" },
  { key: "10h", label: "10 годин" },
  { key: "24h", label: "24 години" },
  { key: "3d", label: "3 дні" },
];

const sensorNames: Record<string, string> = {
  "1": "Опорос",
  "2": "Супорос 1",
  "3": "Супорос 2",
  "4": "Супорос 3",
  "5": "Відгодівля",
  "6": "Дорощювання",
  "7": "Рем свинки",
  "8": "Двір",
};

const ZONES = [
  { from: 0, to: 15, label: "Холодно", color: "rgba(70, 130, 255, 0.18)" },
  { from: 15, to: 25, label: "Норма", color: "rgba(34, 197, 94, 0.18)" },
  { from: 25, to: 100, label: "Жарко", color: "rgba(239, 68, 68, 0.18)" },
];

function parseHistoryDate(dateString: string) {
  const hasTimezone = /([zZ]|[+\-]\d{2}:\d{2})$/.test(dateString);

  if (hasTimezone) {
    return new Date(dateString);
  }

  return new Date(`${dateString}Z`);
}

function normalizeHistory(input: unknown): HistoryPoint[] {
  let rows: HistoryPoint[] = [];

  if (Array.isArray(input)) {
    rows = input
      .map((item: any) => ({
        temp: Number(item?.temp ?? item?.temperature ?? item?.value ?? 0),
        time: String(
          item?.time ??
            item?.created_at ??
            item?.createdAt ??
            item?.timestamp ??
            ""
        ),
      }))
      .filter((item) => !Number.isNaN(item.temp) && item.time);
  }

  if (input && typeof input === "object") {
    const obj = input as Record<string, unknown>;
    if (Array.isArray(obj.history)) rows = normalizeHistory(obj.history);
    if (Array.isArray(obj.data)) rows = normalizeHistory(obj.data);
    if (Array.isArray(obj.rows)) rows = normalizeHistory(obj.rows);
  }

  return rows;
}

function formatKyivTime(dateString: string, period: PeriodKey) {
  const date = parseHistoryDate(dateString);

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

function buildChart(points: HistoryPoint[]) {
  const width = 900;
  const height = 360;

  const margin = {
    top: 20,
    right: 20,
    bottom: 46,
    left: 62,
  };

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  if (!points.length) {
    return {
      width,
      height,
      margin,
      path: "",
      yTicks: [0, 10, 20, 30, 40],
      xTicks: [],
      plottedPoints: [] as HoveredPoint[],
      yMax: 40,
      innerHeight,
      innerWidth,
    };
  }

  const temps = points.map((p) => p.temp);
  const maxTempRaw = Math.max(...temps, 0);
  const yMax = Math.max(40, Math.ceil((maxTempRaw + 2) / 5) * 5);
  const yMin = 0;
  const yRange = yMax - yMin || 1;

  const plottedPoints: HoveredPoint[] = points.map((point, index) => {
    const x =
      margin.left + (index / Math.max(points.length - 1, 1)) * innerWidth;
    const y =
      margin.top +
      innerHeight -
      ((point.temp - yMin) / yRange) * innerHeight;

    return {
      x,
      y,
      temp: point.temp,
      time: point.time,
    };
  });

  const path = plottedPoints
    .map((point, index) => {
      return `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(
        2
      )}`;
    })
    .join(" ");

  const yTicks = Array.from({ length: 5 }, (_, i) =>
    Math.round((yMax / 4) * i)
  );

  const tickCount = 5;
  const xTicks = Array.from({ length: tickCount }, (_, i) => {
    const index = Math.min(
      points.length - 1,
      Math.round((i / (tickCount - 1)) * (points.length - 1))
    );

    const x =
      margin.left + (index / Math.max(points.length - 1, 1)) * innerWidth;

    return {
      x,
      label: points[index]?.time ?? "",
    };
  });

  return {
    width,
    height,
    margin,
    path,
    yTicks,
    xTicks,
    plottedPoints,
    yMax,
    innerHeight,
    innerWidth,
  };
}

function zoneRect(
  from: number,
  to: number,
  yMax: number,
  margin: { top: number; left: number; right: number; bottom: number },
  innerWidth: number,
  innerHeight: number
) {
  const safeTo = Math.min(to, yMax);
  const safeFrom = Math.min(from, yMax);

  const yTop = margin.top + innerHeight - (safeTo / yMax) * innerHeight;
  const yBottom = margin.top + innerHeight - (safeFrom / yMax) * innerHeight;

  return {
    x: margin.left,
    y: yTop,
    width: innerWidth,
    height: Math.max(0, yBottom - yTop),
  };
}

function StatCard({
  title,
  value,
  background,
  border,
}: {
  title: string;
  value: number;
  background: string;
  border: string;
}) {
  return (
    <div
      style={{
        background,
        border,
        borderRadius: 18,
        padding: 16,
        boxShadow: "0 10px 22px rgba(0,0,0,0.18)",
      }}
    >
      <div style={{ opacity: 0.9, fontSize: 14 }}>{title}</div>
      <div style={{ fontSize: 30, fontWeight: 900, marginTop: 4 }}>
        {value.toFixed(1)}°C
      </div>
    </div>
  );
}

export default function ChartPage() {
  const params = useParams();
  const id = String(params?.id ?? "1");

  const [period, setPeriod] = useState<PeriodKey>("24h");
  const [points, setPoints] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hovered, setHovered] = useState<HoveredPoint | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`/api/history?range=${period}`, {
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
  }, [period]);

  const chart = useMemo(() => buildChart(points), [points]);

  const temps = points.map((p) => p.temp);
  const minTemp = temps.length ? Math.min(...temps) : 0;
  const maxTemp = temps.length ? Math.max(...temps) : 0;
  const lastTemp = temps.length ? temps[temps.length - 1] : 0;

  const tooltip = hovered
    ? {
        width: 150,
        height: 54,
        x: Math.min(Math.max(hovered.x - 75, 12), 900 - 150 - 12),
        y: Math.max(hovered.y - 70, 10),
      }
    : null;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg,#091225,#0c1630)",
        color: "white",
        padding: 20,
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
            marginBottom: 20,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: 18, opacity: 0.82, marginBottom: 8 }}>
              Графік температури
            </div>
            <div style={{ fontSize: 34, fontWeight: 900, lineHeight: 1.05 }}>
              {sensorNames[id] ?? `Сенсор ${id}`}
            </div>
          </div>

          <Link
            href="/"
            style={{
              color: "white",
              textDecoration: "none",
              background: "#173a84",
              padding: "10px 16px",
              borderRadius: 12,
              fontWeight: 700,
            }}
          >
            Назад
          </Link>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          {periods.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              style={{
                border: "none",
                borderRadius: 12,
                padding: "10px 14px",
                cursor: "pointer",
                background: period === p.key ? "#22b8ff" : "#173a84",
                color: "white",
                fontWeight: 700,
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            marginBottom: 18,
          }}
        >
          {ZONES.map((zone) => (
            <div
              key={zone.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "#10214f",
                borderRadius: 12,
                padding: "8px 12px",
                fontSize: 14,
              }}
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 4,
                  background: zone.color.replace("0.18", "0.9"),
                  display: "inline-block",
                }}
              />
              {zone.label}
            </div>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 12,
            marginBottom: 18,
          }}
        >
          <StatCard
            title="Поточна"
            value={lastTemp}
            background="linear-gradient(180deg,#0f4c81,#0c365c)"
            border="1px solid rgba(85, 216, 255, 0.24)"
          />

          <StatCard
            title="Min"
            value={minTemp}
            background="linear-gradient(180deg,#0d3f86,#0a2f63)"
            border="1px solid rgba(120, 175, 255, 0.24)"
          />

          <StatCard
            title="Max"
            value={maxTemp}
            background="linear-gradient(180deg,#7b2c1e,#5a1d13)"
            border="1px solid rgba(255, 154, 116, 0.24)"
          />
        </div>

        <div
          style={{
            background: "#10214f",
            borderRadius: 24,
            padding: 20,
            minHeight: 420,
            boxShadow: "0 12px 28px rgba(0,0,0,0.22)",
          }}
        >
          {loading ? (
            <div style={{ opacity: 0.8 }}>Завантаження графіка...</div>
          ) : error ? (
            <div style={{ color: "#ffb3b3" }}>{error}</div>
          ) : points.length === 0 ? (
            <div style={{ opacity: 0.8 }}>
              Немає даних для графіка за цей період
            </div>
          ) : (
            <svg
              width="100%"
              height="420"
              viewBox="0 0 900 360"
              onMouseLeave={() => setHovered(null)}
            >
              {ZONES.map((zone) => {
                const rect = zoneRect(
                  zone.from,
                  zone.to,
                  chart.yMax,
                  chart.margin,
                  chart.innerWidth,
                  chart.innerHeight
                );

                return (
                  <rect
                    key={zone.label}
                    x={rect.x}
                    y={rect.y}
                    width={rect.width}
                    height={rect.height}
                    fill={zone.color}
                  />
                );
              })}

              {chart.yTicks.map((tick) => {
                const y =
                  chart.margin.top +
                  chart.innerHeight -
                  (tick / (chart.yMax || 1)) * chart.innerHeight;

                return (
                  <g key={tick}>
                    <line
                      x1={chart.margin.left}
                      y1={y}
                      x2={900 - chart.margin.right}
                      y2={y}
                      stroke="rgba(255,255,255,0.12)"
                      strokeWidth="1"
                    />
                    <text
                      x={chart.margin.left - 10}
                      y={y + 4}
                      fill="rgba(255,255,255,0.8)"
                      fontSize="12"
                      textAnchor="end"
                    >
                      {tick}°C
                    </text>
                  </g>
                );
              })}

              {chart.xTicks.map((tick, index) => (
                <g key={index}>
                  <line
                    x1={tick.x}
                    y1={chart.margin.top}
                    x2={tick.x}
                    y2={360 - chart.margin.bottom}
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth="1"
                  />
                  <text
                    x={tick.x}
                    y={360 - 14}
                    fill="rgba(255,255,255,0.8)"
                    fontSize="12"
                    textAnchor="middle"
                  >
                    {formatKyivTime(tick.label, period)}
                  </text>
                </g>
              ))}

              <line
                x1={chart.margin.left}
                y1={chart.margin.top}
                x2={chart.margin.left}
                y2={360 - chart.margin.bottom}
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="1.5"
              />
              <line
                x1={chart.margin.left}
                y1={360 - chart.margin.bottom}
                x2={900 - chart.margin.right}
                y2={360 - chart.margin.bottom}
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="1.5"
              />

              <path
                d={chart.path}
                fill="none"
                stroke="#55d8ff"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {chart.plottedPoints.map((point, index) => (
                <circle
                  key={index}
                  cx={point.x}
                  cy={point.y}
                  r={7}
                  fill="transparent"
                  onMouseEnter={() => setHovered(point)}
                  onMouseMove={() => setHovered(point)}
                />
              ))}

              {hovered && tooltip && (
                <g pointerEvents="none">
                  <line
                    x1={hovered.x}
                    y1={chart.margin.top}
                    x2={hovered.x}
                    y2={360 - chart.margin.bottom}
                    stroke="rgba(85,216,255,0.45)"
                    strokeDasharray="4 4"
                  />
                  <circle
                    cx={hovered.x}
                    cy={hovered.y}
                    r={5}
                    fill="#55d8ff"
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                  <rect
                    x={tooltip.x}
                    y={tooltip.y}
                    width={tooltip.width}
                    height={tooltip.height}
                    rx={12}
                    fill="rgba(8,18,40,0.96)"
                    stroke="rgba(85,216,255,0.4)"
                  />
                  <text
                    x={tooltip.x + 10}
                    y={tooltip.y + 22}
                    fill="#ffffff"
                    fontSize="13"
                    fontWeight="700"
                  >
                    {hovered.temp.toFixed(1)}°C
                  </text>
                  <text
                    x={tooltip.x + 10}
                    y={tooltip.y + 40}
                    fill="rgba(255,255,255,0.82)"
                    fontSize="12"
                  >
                    {formatKyivTime(hovered.time, period)}
                  </text>
                </g>
              )}
            </svg>
          )}
        </div>
      </div>
    </main>
  );
}