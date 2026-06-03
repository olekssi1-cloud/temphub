"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type PeriodKey = "12h" | "1d" | "3d";

type HistoryPoint = {
  temp: number | null;
  humidity: number | null;
  rpm: number | null;
  mode: "auto" | "manual";
  motorGraph: number | null;
  time: string;
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
      temp: item?.temp === null ? null : Number(item?.temp),
      humidity: item?.humidity === null ? null : Number(item?.humidity),
      rpm: item?.rpm === null ? null : Number(item?.rpm),
      mode: item?.mode === "manual" ? "manual" : "auto",
      motorGraph:
        item?.motorGraph === null || item?.motorGraph === undefined
          ? null
          : Number(item?.motorGraph),
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

function minMax(values: Array<number | null>) {
  const nums = values.filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
  return {
    min: nums.length ? Math.min(...nums) : 0,
    max: nums.length ? Math.max(...nums) : 0,
    last: nums.length ? nums[nums.length - 1] : 0,
  };
}

function buildPath(
  points: HistoryPoint[],
  key: "temp" | "humidity" | "motorGraph",
  yMax: number,
  width: number,
  height: number,
  margin: { top: number; right: number; bottom: number; left: number }
) {
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  let path = "";
  let started = false;

  points.forEach((point, index) => {
    const value = point[key];

    if (value === null || Number.isNaN(value)) {
      started = false;
      return;
    }

    const x = margin.left + (index / Math.max(points.length - 1, 1)) * innerWidth;
    const y = margin.top + innerHeight - (value / yMax) * innerHeight;

    path += `${started ? " L" : " M"}${x.toFixed(2)},${y.toFixed(2)}`;
    started = true;
  });

  return path.trim();
}

export default function ChartPage() {
  const params = useParams();
  const id = String(params?.id ?? "1");

  const [period, setPeriod] = useState<PeriodKey>("12h");
  const [points, setPoints] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showTemp, setShowTemp] = useState(true);
  const [showHumidity, setShowHumidity] = useState(true);
  const [showMotor, setShowMotor] = useState(true);

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
      } catch (err) {
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
  const humidityStats = useMemo(() => minMax(points.map((p) => p.humidity)), [points]);
  const motorStats = useMemo(() => minMax(points.map((p) => p.motorGraph)), [points]);

  const lastPoint = points.length ? points[points.length - 1] : null;
  const motorCurrent =
    lastPoint?.mode === "manual"
      ? "Ручне"
      : `${Math.round(lastPoint?.rpm ?? 0)}%`;

  const chart = useMemo(() => {
    const width = 900;
    const height = 420;
    const margin = { top: 24, right: 58, bottom: 50, left: 58 };

    const yMax = 100;

    const tempPath = buildPath(points, "temp", yMax, width, height, margin);
    const humidityPath = buildPath(points, "humidity", yMax, width, height, margin);
    const motorPath = buildPath(points, "motorGraph", yMax, width, height, margin);

    const tickCount = 5;
    const innerWidth = width - margin.left - margin.right;

    const xTicks = Array.from({ length: tickCount }, (_, i) => {
      const index = Math.min(
        points.length - 1,
        Math.round((i / (tickCount - 1)) * Math.max(points.length - 1, 0))
      );

      const x = margin.left + (index / Math.max(points.length - 1, 1)) * innerWidth;

      return {
        x,
        label: points[index]?.time ?? "",
      };
    });

    return {
      width,
      height,
      margin,
      yMax,
      tempPath,
      humidityPath,
      motorPath,
      xTicks,
      yTicks: [0, 25, 50, 75, 100],
    };
  }, [points]);

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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 18,
          }}
        >
          <Link
            href="/"
            style={{
              color: "#0f172a",
              textDecoration: "none",
              fontSize: 34,
              fontWeight: 900,
            }}
          >
            ‹
          </Link>

          <div style={{ textAlign: "center" }}>
            <h1 style={{ fontSize: 34, margin: 0 }}>Графік</h1>
            <div style={{ fontSize: 22, marginTop: 8 }}>
              {sensorNames[id] ?? `Сенсор ${id}`}
            </div>
          </div>

          <div
            style={{
              width: 84,
              height: 44,
              borderRadius: 999,
              background: "#e5e7eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-around",
              fontSize: 24,
            }}
          >
            ☀️ 🌙
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 12,
            marginBottom: 16,
          }}
        >
          {periods.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 16,
                padding: "14px 8px",
                cursor: "pointer",
                background:
                  period === p.key
                    ? "linear-gradient(135deg,#7c3aed,#6d28d9)"
                    : "white",
                color: period === p.key ? "white" : "#0f172a",
                fontWeight: 800,
                fontSize: 18,
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div style={cardStyle("#dbeafe")}>
            <div style={{ fontSize: 18 }}>🌡 Температура</div>
            <div style={bigValueStyle}>{tempStats.last.toFixed(1)}°C</div>
            <div style={minMaxStyle}>
              Мін. {tempStats.min.toFixed(1)}°C<br />
              Макс. {tempStats.max.toFixed(1)}°C
            </div>
          </div>

          <div style={cardStyle("#dcfce7")}>
            <div style={{ fontSize: 18 }}>💧 Вологість</div>
            <div style={bigValueStyle}>{humidityStats.last.toFixed(1)}%</div>
            <div style={minMaxStyle}>
              Мін. {humidityStats.min.toFixed(1)}%<br />
              Макс. {humidityStats.max.toFixed(1)}%
            </div>
          </div>

          <div style={cardStyle("#ffedd5")}>
            <div style={{ fontSize: 18 }}>🌀 Двигун</div>
            <div style={bigValueStyle}>{motorCurrent}</div>
            <div style={minMaxStyle}>
              Мін. {motorStats.min.toFixed(0)}%<br />
              Макс. {motorStats.max.toFixed(0)}%
            </div>
          </div>
        </div>

        <div
          style={{
            background: "white",
            borderRadius: 22,
            border: "1px solid #e5e7eb",
            padding: 14,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 14,
              flexWrap: "wrap",
              marginBottom: 12,
              fontSize: 16,
              fontWeight: 700,
            }}
          >
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
            <svg width="100%" height="420" viewBox="0 0 900 420">
              {chart.yTicks.map((tick) => {
                const y =
                  chart.margin.top +
                  (chart.height - chart.margin.top - chart.margin.bottom) -
                  (tick / chart.yMax) *
                    (chart.height - chart.margin.top - chart.margin.bottom);

                return (
                  <g key={tick}>
                    <line
                      x1={chart.margin.left}
                      y1={y}
                      x2={chart.width - chart.margin.right}
                      y2={y}
                      stroke="#e5e7eb"
                    />
                    <text
                      x={chart.margin.left - 10}
                      y={y + 4}
                      fill="#64748b"
                      fontSize="13"
                      textAnchor="end"
                    >
                      {tick}
                    </text>
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
            </svg>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 8,
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: 18,
            overflow: "hidden",
          }}
        >
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

function cardStyle(borderColor: string): React.CSSProperties {
  return {
    background: "white",
    border: `1px solid ${borderColor}`,
    borderRadius: 18,
    padding: 14,
    minHeight: 130,
  };
}

const bigValueStyle: React.CSSProperties = {
  fontSize: 34,
  fontWeight: 900,
  marginTop: 16,
};

const minMaxStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 16,
  marginTop: 12,
  lineHeight: 1.5,
};

const navStyle: React.CSSProperties = {
  textAlign: "center",
  padding: "14px 6px",
  color: "#0f172a",
  textDecoration: "none",
  fontWeight: 800,
};