"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Point = {
  temp: number;
  time: string;
};

const sensorTitles: Record<number, string> = {
  1: "Опорос",
  2: "Супорос 1",
  3: "Супорос 2",
  4: "Супорос 3",
  5: "Відгодівля",
  6: "Дорощування",
  7: "Рем свинки 6",
  8: "Двір",
};

const ranges = [
  { key: "1h", label: "1 година" },
  { key: "10h", label: "10 годин" },
  { key: "24h", label: "24 години" },
  { key: "3d", label: "3 дні" },
];

function formatKyivTime(value: string) {
  return new Intl.DateTimeFormat("uk-UA", {
    timeZone: "Europe/Kyiv",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatKyivDateTime(value: string) {
  return new Intl.DateTimeFormat("uk-UA", {
    timeZone: "Europe/Kyiv",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function ChartPage() {
  const params = useParams();
  const rawId = params?.id;
  const sensorId = Number(Array.isArray(rawId) ? rawId[0] : rawId);

  const [range, setRange] = useState("24h");
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      if (!sensorId || Number.isNaN(sensorId)) return;

      try {
        setLoading(true);

        const res = await fetch(
          `/api/history?sensorId=${sensorId}&range=${range}`,
          { cache: "no-store" }
        );

        const json = await res.json();
        setPoints(Array.isArray(json) ? json : []);
      } catch (error) {
        console.error("chart load error", error);
        setPoints([]);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [sensorId, range]);

  const chart = useMemo(() => {
    const width = 900;
    const height = 420;
    const left = 58;
    const right = 20;
    const top = 18;
    const bottom = 42;

    const innerWidth = width - left - right;
    const innerHeight = height - top - bottom;

    const safeTemps = points.length ? points.map((p) => p.temp) : [0];
    const maxTemp = Math.max(...safeTemps, 30);
    const minTemp = Math.min(...safeTemps, 0);

    const yMin = 0;
    const yMax = Math.max(30, Math.ceil(maxTemp + 2));

    const tempToY = (temp: number) =>
      top + innerHeight - ((temp - yMin) / (yMax - yMin)) * innerHeight;

    const xAt = (index: number) =>
      left +
      (points.length <= 1 ? innerWidth / 2 : (index / (points.length - 1)) * innerWidth);

    const path = points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${tempToY(p.temp)}`)
      .join(" ");

    return {
      width,
      height,
      left,
      right,
      top,
      bottom,
      innerWidth,
      innerHeight,
      yMin,
      yMax,
      tempToY,
      xAt,
      path,
      min: Math.min(...safeTemps),
      max: Math.max(...safeTemps),
      current: safeTemps[safeTemps.length - 1] ?? 0,
    };
  }, [points]);

  const activePoint =
    activeIndex !== null && points[activeIndex] ? points[activeIndex] : null;

  const title = sensorTitles[sensorId] ?? `Сенсор ${sensorId}`;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg,#07142a,#0b1b3a)",
        color: "white",
        padding: 16,
      }}
    >
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            alignItems: "flex-start",
            marginBottom: 16,
          }}
        >
          <div>
            <div style={{ fontSize: 22, opacity: 0.9 }}>Графік температури</div>
            <div style={{ fontSize: 42, fontWeight: 900 }}>{title}</div>
          </div>

          <Link
            href="/"
            style={{
              textDecoration: "none",
              color: "white",
              background: "#244aa8",
              padding: "12px 18px",
              borderRadius: 16,
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
          {ranges.map((item) => (
            <button
              key={item.key}
              onClick={() => setRange(item.key)}
              style={{
                border: 0,
                borderRadius: 14,
                padding: "12px 18px",
                fontWeight: 800,
                color: "white",
                cursor: "pointer",
                background:
                  range === item.key
                    ? "linear-gradient(90deg,#2d9cff,#30d5ff)"
                    : "#244aa8",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,minmax(0,1fr))",
            gap: 14,
            marginBottom: 18,
          }}
        >
          <div
            style={{
              background: "linear-gradient(180deg,#12579c,#11437e)",
              borderRadius: 20,
              padding: 18,
            }}
          >
            <div style={{ opacity: 0.85 }}>Поточна</div>
            <div style={{ fontSize: 28, fontWeight: 900 }}>
              {chart.current.toFixed(1)}°C
            </div>
          </div>

          <div
            style={{
              background: "linear-gradient(180deg,#174d8f,#123c72)",
              borderRadius: 20,
              padding: 18,
            }}
          >
            <div style={{ opacity: 0.85 }}>Min</div>
            <div style={{ fontSize: 28, fontWeight: 900 }}>
              {chart.min.toFixed(1)}°C
            </div>
          </div>

          <div
            style={{
              background: "linear-gradient(180deg,#7a2e18,#5c1f11)",
              borderRadius: 20,
              padding: 18,
            }}
          >
            <div style={{ opacity: 0.85 }}>Max</div>
            <div style={{ fontSize: 28, fontWeight: 900 }}>
              {chart.max.toFixed(1)}°C
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 14,
          }}
        >
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 14,
              background: "#1c3f93",
            }}
          >
            Холодно до 15°C
          </div>
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 14,
              background: "#1b6b52",
            }}
          >
            Норма 15–25°C
          </div>
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 14,
              background: "#7d2432",
            }}
          >
            Жарко 25°C+
          </div>
        </div>

        <div
          style={{
            background: "linear-gradient(180deg,#132867,#102255)",
            borderRadius: 28,
            padding: 18,
            position: "relative",
            overflow: "hidden",
            minHeight: 320,
          }}
        >
          {loading ? (
            <div style={{ padding: 40, textAlign: "center" }}>Завантаження...</div>
          ) : points.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center" }}>
              Немає даних для цього датчика
            </div>
          ) : (
            <>
              {activePoint && (
                <div
                  style={{
                    position: "absolute",
                    right: 16,
                    top: 16,
                    zIndex: 5,
                    background: "rgba(8,15,32,0.95)",
                    borderRadius: 14,
                    padding: "10px 14px",
                    border: "1px solid rgba(255,255,255,0.12)",
                  }}
                >
                  <div style={{ fontWeight: 900 }}>
                    {activePoint.temp.toFixed(1)}°C
                  </div>
                  <div style={{ fontSize: 14, opacity: 0.85 }}>
                    {formatKyivDateTime(activePoint.time)}
                  </div>
                </div>
              )}

              <svg
                viewBox={`0 0 ${chart.width} ${chart.height}`}
                style={{ width: "100%", height: "auto", display: "block" }}
              >
                <rect
                  x={chart.left}
                  y={chart.tempToY(chart.yMax)}
                  width={chart.innerWidth}
                  height={chart.tempToY(25) - chart.tempToY(chart.yMax)}
                  fill="rgba(220,53,69,0.16)"
                />
                <rect
                  x={chart.left}
                  y={chart.tempToY(25)}
                  width={chart.innerWidth}
                  height={chart.tempToY(15) - chart.tempToY(25)}
                  fill="rgba(46,204,113,0.14)"
                />
                <rect
                  x={chart.left}
                  y={chart.tempToY(15)}
                  width={chart.innerWidth}
                  height={chart.tempToY(0) - chart.tempToY(15)}
                  fill="rgba(52,152,219,0.16)"
                />

                {[0, 10, 15, 20, 25, 30, chart.yMax]
                  .filter((v, i, a) => a.indexOf(v) === i)
                  .map((t) => {
                    const y = chart.tempToY(t);
                    return (
                      <g key={t}>
                        <line
                          x1={chart.left}
                          y1={y}
                          x2={chart.width - chart.right}
                          y2={y}
                          stroke="rgba(255,255,255,0.1)"
                        />
                        <text
                          x={12}
                          y={y + 5}
                          fill="rgba(255,255,255,0.85)"
                          fontSize="14"
                          fontWeight="700"
                        >
                          {t}°C
                        </text>
                      </g>
                    );
                  })}

                {[0, Math.floor((points.length - 1) / 3), Math.floor(((points.length - 1) * 2) / 3), points.length - 1]
                  .filter((v, i, a) => v >= 0 && a.indexOf(v) === i)
                  .map((index) => {
                    const x = chart.xAt(index);
                    return (
                      <g key={index}>
                        <line
                          x1={x}
                          y1={chart.top}
                          x2={x}
                          y2={chart.height - chart.bottom}
                          stroke="rgba(255,255,255,0.06)"
                        />
                        <text
                          x={x}
                          y={chart.height - 10}
                          fill="rgba(255,255,255,0.85)"
                          fontSize="14"
                          textAnchor="middle"
                        >
                          {formatKyivTime(points[index].time)}
                        </text>
                      </g>
                    );
                  })}

                <path
                  d={chart.path}
                  fill="none"
                  stroke="#5fdcff"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {points.map((point, index) => {
                  const x = chart.xAt(index);
                  const y = chart.tempToY(point.temp);

                  return (
                    <g key={index}>
                      <circle
                        cx={x}
                        cy={y}
                        r="14"
                        fill="transparent"
                        onClick={() => setActiveIndex(index)}
                      />
                      {activeIndex === index && (
                        <circle cx={x} cy={y} r="5" fill="#5fdcff" />
                      )}
                    </g>
                  );
                })}
              </svg>
            </>
          )}
        </div>
      </div>
    </main>
  );
}