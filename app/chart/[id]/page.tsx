"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent, TouchEvent } from "react";

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

type GestureState =
  | null
  | {
      mode: "pan";
      startX: number;
      startStart: number;
      startEnd: number;
    }
  | {
      mode: "pinch";
      startDistance: number;
      startStart: number;
      startEnd: number;
      centerTime: number;
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

const MIN_ZOOM_MS = 60 * 1000; // мінімум 1 хвилина

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
    .filter((item) => item.time)
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
}

function formatKyivTime(dateString: string, period: PeriodKey, visibleMs?: number) {
  const date = new Date(dateString);

  if (visibleMs !== undefined && visibleMs <= 20 * 60 * 1000) {
    return new Intl.DateTimeFormat("uk-UA", {
      timeZone: "Europe/Kyiv",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(date);
  }

  if (period === "3d" || (visibleMs !== undefined && visibleMs > 24 * 60 * 60 * 1000)) {
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

function formatDuration(ms: number) {
  const minutes = Math.max(1, Math.round(ms / 60000));

  if (minutes < 60) return `${minutes} хв`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (rest === 0) return `${hours} год`;
  return `${hours} год ${rest} хв`;
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

function getScale(values: Array<number | null>, fallback: { min: number; max: number }, padding = 2) {
  const nums = values.filter(
    (v): v is number => typeof v === "number" && !Number.isNaN(v)
  );

  if (!nums.length) return fallback;

  const minRaw = Math.min(...nums);
  const maxRaw = Math.max(...nums);

  let min = Math.floor(minRaw - padding);
  let max = Math.ceil(maxRaw + padding);

  if (max - min < 6) {
    const middle = (max + min) / 2;
    min = Math.floor(middle - 3);
    max = Math.ceil(middle + 3);
  }

  return { min, max };
}

function clampDomain(start: number, end: number, fullStart: number, fullEnd: number) {
  const fullDuration = Math.max(fullEnd - fullStart, MIN_ZOOM_MS);
  let duration = Math.max(MIN_ZOOM_MS, Math.min(end - start, fullDuration));

  let nextStart = start;
  let nextEnd = nextStart + duration;

  if (nextStart < fullStart) {
    nextStart = fullStart;
    nextEnd = nextStart + duration;
  }

  if (nextEnd > fullEnd) {
    nextEnd = fullEnd;
    nextStart = nextEnd - duration;
  }

  if (nextStart < fullStart) nextStart = fullStart;
  if (nextEnd > fullEnd) nextEnd = fullEnd;

  return { start: nextStart, end: nextEnd };
}

function buildPathByTime(
  points: HistoryPoint[],
  key: "temp" | "humidity" | "motorGraph",
  valueToY: (value: number) => number,
  timeToX: (timeMs: number) => number
) {
  let path = "";
  let started = false;

  points.forEach((point, index) => {
    const value = point[key];

    if (value === null || value === undefined || Number.isNaN(value)) {
      started = false;
      return;
    }

    const timeMs = new Date(point.time).getTime();

    if (index > 0) {
      const prevTime = new Date(points[index - 1].time).getTime();
      if (timeMs - prevTime > 3 * 60 * 1000) started = false;
    }

    const x = timeToX(timeMs);
    const y = valueToY(value);

    path += `${started ? " L" : " M"}${x.toFixed(2)},${y.toFixed(2)}`;
    started = true;
  });

  return path.trim();
}

function nearestPointIndex(points: HistoryPoint[], targetMs: number) {
  if (!points.length) return 0;

  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  points.forEach((point, index) => {
    const distance = Math.abs(new Date(point.time).getTime() - targetMs);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  return bestIndex;
}

export default function ChartPage() {
  const params = useParams();
  const id = String(params?.id ?? "1");

  const svgRef = useRef<SVGSVGElement | null>(null);
  const gestureRef = useRef<GestureState>(null);

  const [period, setPeriod] = useState<PeriodKey>("12h");
  const [points, setPoints] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewDomain, setViewDomain] = useState<{ start: number; end: number } | null>(null);

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

          if (normalized.length > 0) {
            const first = new Date(normalized[0].time).getTime();
            const last = new Date(normalized[normalized.length - 1].time).getTime();
            setViewDomain({ start: first, end: Math.max(last, first + MIN_ZOOM_MS) });
          } else {
            setViewDomain(null);
          }
        }
      } catch {
        if (!cancelled) {
          setError("Не вдалося завантажити графік");
          setPoints([]);
          setViewDomain(null);
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

  const fullDomain = useMemo(() => {
    if (!points.length) return null;

    const first = new Date(points[0].time).getTime();
    const last = new Date(points[points.length - 1].time).getTime();

    return { start: first, end: Math.max(last, first + MIN_ZOOM_MS) };
  }, [points]);

  const activeDomain = viewDomain ?? fullDomain;

  const visiblePoints = useMemo(() => {
    if (!activeDomain) return [];

    return points.filter((point) => {
      const t = new Date(point.time).getTime();
      return t >= activeDomain.start && t <= activeDomain.end;
    });
  }, [points, activeDomain]);

  const statsPoints = visiblePoints.length ? visiblePoints : points;

  const tempStats = useMemo(
    () => minMax(statsPoints.map((p) => p.temp)),
    [statsPoints]
  );
  const humidityStats = useMemo(
    () => minMax(statsPoints.map((p) => p.humidity)),
    [statsPoints]
  );
  const motorStats = useMemo(
    () => minMax(statsPoints.map((p) => p.motorGraph)),
    [statsPoints]
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

    const domain =
      activeDomain ??
      (points.length
        ? {
            start: new Date(points[0].time).getTime(),
            end: new Date(points[points.length - 1].time).getTime(),
          }
        : { start: 0, end: MIN_ZOOM_MS });

    const visibleDuration = Math.max(domain.end - domain.start, MIN_ZOOM_MS);
    const visible = visiblePoints.length ? visiblePoints : points;

    const tempScale = getScale(visible.map((p) => p.temp), { min: 0, max: 30 }, 2);
    const tempRange = tempScale.max - tempScale.min || 1;

    const tempToY = (value: number) =>
      margin.top +
      innerHeight -
      ((value - tempScale.min) / tempRange) * innerHeight;

    const percentScale = getScale(
      [...visible.map((p) => p.humidity), ...visible.map((p) => p.motorGraph)],
      { min: 0, max: 100 },
      5
    );

    const percentMin = Math.max(0, Math.floor(percentScale.min));
    const percentMax = Math.min(100, Math.ceil(percentScale.max));
    const percentRange = Math.max(percentMax - percentMin, 1);

    const percentToY = (value: number) =>
      margin.top + innerHeight - ((value - percentMin) / percentRange) * innerHeight;

    const timeToX = (timeMs: number) =>
      margin.left + ((timeMs - domain.start) / visibleDuration) * innerWidth;

    const xToTime = (x: number) => {
      const ratio = (x - margin.left) / Math.max(innerWidth, 1);
      return domain.start + ratio * visibleDuration;
    };

    const tempPath = buildPathByTime(visible, "temp", tempToY, timeToX);
    const humidityPath = buildPathByTime(visible, "humidity", percentToY, timeToX);
    const motorPath = buildPathByTime(visible, "motorGraph", percentToY, timeToX);

    const tickCount = visibleDuration <= 20 * 60 * 1000 ? 6 : 5;
    const xTicks = Array.from({ length: tickCount }, (_, i) => {
      const timeMs = domain.start + (i / Math.max(tickCount - 1, 1)) * visibleDuration;
      return {
        x: timeToX(timeMs),
        label: new Date(timeMs).toISOString(),
      };
    });

    const tempTicks = Array.from({ length: 5 }, (_, i) =>
      Number((tempScale.min + (i / 4) * tempRange).toFixed(1))
    );

    const percentTicks = Array.from({ length: 5 }, (_, i) =>
      Number((percentMin + (i / 4) * percentRange).toFixed(0))
    );

    return {
      width,
      height,
      margin,
      innerWidth,
      tempToY,
      percentToY,
      timeToX,
      xToTime,
      tempPath,
      humidityPath,
      motorPath,
      xTicks,
      tempTicks,
      percentTicks,
      visibleDuration,
      domain,
    };
  }, [points, visiblePoints, activeDomain]);

  function getSvgX(clientX: number) {
    if (!svgRef.current) return 0;

    const rect = svgRef.current.getBoundingClientRect();
    return ((clientX - rect.left) / rect.width) * chart.width;
  }

  function handleMouseMove(event: MouseEvent<SVGSVGElement>) {
    if (!svgRef.current || !visiblePoints.length) return;

    const viewX = getSvgX(event.clientX);
    const startX = chart.margin.left;
    const endX = chart.width - chart.margin.right;
    const clampedX = Math.max(startX, Math.min(endX, viewX));
    const targetTime = chart.xToTime(clampedX);
    const localIndex = nearestPointIndex(visiblePoints, targetTime);
    const point = visiblePoints[localIndex];
    const globalIndex = points.indexOf(point);

    setTooltip({
      visible: true,
      index: Math.max(0, globalIndex),
      x: chart.timeToX(new Date(point.time).getTime()),
    });
  }

  function getTouchDistance(event: TouchEvent<SVGSVGElement>) {
    const a = event.touches[0];
    const b = event.touches[1];

    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }

  function getTouchCenterX(event: TouchEvent<SVGSVGElement>) {
    const a = event.touches[0];
    const b = event.touches[1];

    return (a.clientX + b.clientX) / 2;
  }

  function handleTouchStart(event: TouchEvent<SVGSVGElement>) {
    if (!activeDomain || !fullDomain) return;

    setTooltip((prev) => ({ ...prev, visible: false }));

    if (event.touches.length === 1) {
      gestureRef.current = {
        mode: "pan",
        startX: event.touches[0].clientX,
        startStart: activeDomain.start,
        startEnd: activeDomain.end,
      };
    }

    if (event.touches.length >= 2) {
      const centerSvgX = getSvgX(getTouchCenterX(event));
      const centerTime = chart.xToTime(centerSvgX);

      gestureRef.current = {
        mode: "pinch",
        startDistance: Math.max(getTouchDistance(event), 1),
        startStart: activeDomain.start,
        startEnd: activeDomain.end,
        centerTime,
      };
    }
  }

  function handleTouchMove(event: TouchEvent<SVGSVGElement>) {
    if (!gestureRef.current || !fullDomain) return;

    event.preventDefault();

    const gesture = gestureRef.current;

    if (gesture.mode === "pan" && event.touches.length === 1) {
      const dxPx = event.touches[0].clientX - gesture.startX;
      const rect = svgRef.current?.getBoundingClientRect();
      const dxSvg = rect ? (dxPx / rect.width) * chart.width : dxPx;
      const duration = gesture.startEnd - gesture.startStart;
      const msPerSvgPx = duration / Math.max(chart.innerWidth, 1);
      const shiftMs = dxSvg * msPerSvgPx;

      const next = clampDomain(
        gesture.startStart - shiftMs,
        gesture.startEnd - shiftMs,
        fullDomain.start,
        fullDomain.end
      );

      setViewDomain(next);
    }

    if (gesture.mode === "pinch" && event.touches.length >= 2) {
      const currentDistance = Math.max(getTouchDistance(event), 1);
      const startDuration = gesture.startEnd - gesture.startStart;
      const rawDuration = startDuration * (gesture.startDistance / currentDistance);
      const fullDuration = fullDomain.end - fullDomain.start;
      const duration = Math.max(MIN_ZOOM_MS, Math.min(rawDuration, fullDuration));

      const centerSvgX = getSvgX(getTouchCenterX(event));
      const ratio = Math.max(
        0,
        Math.min(
          1,
          (centerSvgX - chart.margin.left) / Math.max(chart.innerWidth, 1)
        )
      );

      const nextStart = gesture.centerTime - ratio * duration;
      const next = clampDomain(
        nextStart,
        nextStart + duration,
        fullDomain.start,
        fullDomain.end
      );

      setViewDomain(next);
    }
  }

  function handleTouchEnd() {
    gestureRef.current = null;
  }

  function resetZoom() {
    setViewDomain(fullDomain);
    setTooltip((prev) => ({ ...prev, visible: false }));
  }

  const tooltipPoint = points[tooltip.index];
  const zoomActive =
    fullDomain &&
    activeDomain &&
    Math.round(activeDomain.end - activeDomain.start) <
      Math.round(fullDomain.end - fullDomain.start);

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

          <div style={zoomRowStyle}>
            <span>
              🔍 Видно: <b>{activeDomain ? formatDuration(activeDomain.end - activeDomain.start) : "—"}</b>
            </span>
            <button
              type="button"
              onClick={resetZoom}
              disabled={!zoomActive}
              style={{
                ...resetButtonStyle,
                opacity: zoomActive ? 1 : 0.45,
              }}
            >
              Скинути
            </button>
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
                onMouseMove={handleMouseMove}
                onMouseLeave={() =>
                  setTooltip((prev) => ({ ...prev, visible: false }))
                }
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
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
                    {formatKyivTime(tick.label, period, chart.visibleDuration)}
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

const zoomRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  marginBottom: 5,
  fontSize: "clamp(11px, 3vw, 13px)",
  color: "#64748b",
  fontWeight: 800,
};

const resetButtonStyle: CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  borderRadius: 999,
  padding: "5px 10px",
  fontWeight: 900,
  color: "#0f172a",
};

const checkLabelStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 3,
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
