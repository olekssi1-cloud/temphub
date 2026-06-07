"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

type Sensor = {
  id: number;
  temp: number;
  updatedAt: string | null;
  min24: number;
  max24: number;
  online: boolean;
  rpm: number;
  humidity: number;
  mode: string;
  wifi_level?: number | null;
  wifiLevel?: number | null;
  wifi_rssi?: number | null;
  wifiRssi?: number | null;
};

const sensorNames: Record<number, string> = {
  1: "Опорос",
  2: "Супорос 1",
  3: "Супорос 2",
  4: "Супорос 3",
  5: "Відгодівля",
  6: "Карантин",
  7: "Подвірʼя",
};

const allIds = [1, 2, 3, 4, 5, 6, 7];
const fanIds = [1, 2, 3, 4, 5, 6];

function formatValue(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "0.0";
  }

  return Number(value).toFixed(digits);
}

function getWifiLevel(sensor: Sensor) {
  const raw = sensor.wifiLevel ?? sensor.wifi_level ?? 0;
  const value = Number(raw);

  if (Number.isNaN(value)) return 0;

  return Math.max(0, Math.min(10, Math.round(value)));
}

function getWifiColor(level: number) {
  if (level >= 8) return "#16a34a";
  if (level >= 5) return "#f59e0b";
  if (level >= 1) return "#dc2626";
  return "#94a3b8";
}

export default function HomePage() {
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/home-summary", { cache: "no-store" });
        const json = await res.json();

        if (!cancelled) {
          setSensors(json.sensors ?? []);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setSensors([]);
          setLoading(false);
        }
      }
    }

    load();
    const timer = setInterval(load, 2000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const rows = useMemo(() => {
    return allIds.map((id) => {
      const found = sensors.find((s) => Number(s.id) === id);

      return (
        found ?? {
          id,
          temp: 0,
          updatedAt: null,
          min24: 0,
          max24: 0,
          online: false,
          rpm: 0,
          humidity: 0,
          mode: "auto",
          wifiLevel: 0,
        }
      );
    });
  }, [sensors]);

  const fanRows = rows.filter((s) => fanIds.includes(Number(s.id)));

  const totalFans = fanRows.length;
  const onlineCount = fanRows.filter((s) => s.online).length;
  const manualCount = fanRows.filter((s) => s.mode === "manual").length;
  const problemCount = fanRows.filter((s) => !s.online).length;

  return (
    <main style={pageStyle}>
      <div style={screenStyle}>
        <header style={headerStyle}>
          <button type="button" style={menuButtonStyle}>
            ☰
          </button>

          <div style={{ textAlign: "center" }}>
            <h1 style={titleStyle}>Вентиляція</h1>
            <div style={subtitleStyle}>Список відділів</div>
          </div>

          <button type="button" style={themeButtonStyle}>
            ☀️🌙
          </button>
        </header>

        <section style={summaryGridStyle}>
          <SummaryCard
            icon={<FanIcon size={34} color="#1684f8" />}
            label="Вентиляторів"
            value={totalFans}
          />
          <SummaryCard icon="📶" label="Онлайн" value={onlineCount} />
          <SummaryCard icon="✋" label="Ручне" value={manualCount} />
          <SummaryCard icon="⚠️" label="Проблеми" value={problemCount} danger />
        </section>

        {loading ? (
          <div style={loadingStyle}>Завантаження...</div>
        ) : (
          <section style={tableWrapStyle}>
            <div style={tableHeaderStyle}>
              <div style={headCellLeftStyle}>Відділ</div>
              <div style={headCellStyle}>🌡</div>
              <div style={headCellStyle}>💧</div>
              <div style={headCellStyle}>
                <FanIcon size={24} color="#334155" />
              </div>
            </div>

            {rows.map((sensor) => {
              const isYard = sensor.id === 7;
              const isManual = sensor.mode === "manual";
              const wifiLevel = getWifiLevel(sensor);
              const wifiColor = getWifiColor(wifiLevel);

              return (
                <Link
                  key={sensor.id}
                  href={`/chart/${sensor.id}`}
                  style={rowStyle}
                >
                  <div style={departmentCellStyle}>
                    <div
                      style={{
                        ...iconCircleStyle,
                        background: isYard
                          ? "linear-gradient(135deg,#86efac,#22c55e)"
                          : sensor.online
                            ? "linear-gradient(135deg,#60a5fa,#0284c7)"
                            : "linear-gradient(135deg,#9ca3af,#374151)",
                      }}
                    >
                      {isYard ? "🏠" : <FanIcon size={24} color="white" />}
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div style={nameStyle}>
                        {sensorNames[sensor.id] ?? `Відділ ${sensor.id}`}
                      </div>

                      {isYard && <div style={noteStyle}>без вентилятора</div>}

                      <div style={statusStyle}>
                        <span
                          style={{
                            ...dotStyle,
                            background: sensor.online ? "#16a34a" : "#dc2626",
                          }}
                        />
                        {sensor.online ? "Онлайн" : "Офлайн"}
                      </div>

                      <div style={wifiStyle}>
                        <WifiIcon color={wifiColor} size={17} />
                        <span>{wifiLevel}</span>
                      </div>
                    </div>
                  </div>

                  <div style={valueCellStyle}>
                    <div
                      style={{
                        ...mainValueStyle,
                        color: sensor.online ? "#0f172a" : "#dc2626",
                      }}
                    >
                      {formatValue(sensor.temp)}°
                    </div>
                    <div style={minMaxStyle}>
                      <span style={{ color: "#2563eb" }}>
                        {formatValue(sensor.min24)}
                      </span>
                      /
                      <span style={{ color: "#dc2626" }}>
                        {formatValue(sensor.max24)}
                      </span>
                    </div>
                  </div>

                  <div style={valueCellStyle}>
                    <div style={mainValueStyle}>
                      {formatValue(sensor.humidity)}%
                    </div>
                    <div style={minMaxStyle}>
                      <span style={{ color: "#2563eb" }}>0.0</span>/
                      <span style={{ color: "#dc2626" }}>
                        {formatValue(sensor.humidity)}
                      </span>
                    </div>
                  </div>

                  <div style={valueCellStyle}>
                    {isYard ? (
                      <>
                        <div style={mainValueStyle}>—</div>
                        <div style={minMaxStyle}>—</div>
                      </>
                    ) : (
                      <>
                        <div
                          style={{
                            ...mainValueStyle,
                            color: isManual ? "#f59e0b" : "#16a34a",
                            fontSize: isManual
                              ? "clamp(13px,3.4vw,18px)"
                              : undefined,
                          }}
                        >
                          {isManual ? "Ручне" : `${Math.round(sensor.rpm)}%`}
                        </div>
                        <div style={minMaxStyle}>10/100</div>
                      </>
                    )}
                  </div>
                </Link>
              );
            })}
          </section>
        )}

        <section style={legendStyle}>
          <LegendItem color="#16a34a" text="Онлайн" />
          <LegendItem color="#dc2626" text="Офлайн" />
          <LegendItem color="#f59e0b" text="Ручне" />
          <LegendItem color="#16a34a" text="% авто" />
        </section>

        <nav style={bottomNavStyle}>
          <Link href="/" style={{ ...bottomNavItemStyle, color: "#7c3aed" }}>
            🏠
            <br />
            Головна
          </Link>

          <Link href="/disconnects" style={bottomNavItemStyle}>
            ⚡
            <br />
            Відключення
          </Link>
        </nav>
      </div>
    </main>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  danger,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div
      style={{
        ...summaryCardStyle,
        borderColor: danger ? "#fecaca" : "#dbeafe",
      }}
    >
      <div style={summaryIconStyle}>{icon}</div>
      <div style={summaryLabelStyle}>{label}</div>
      <div style={summaryValueStyle}>{value}</div>
    </div>
  );
}

function LegendItem({ color, text }: { color: string; text: string }) {
  return (
    <div style={legendItemStyle}>
      <span style={{ ...legendDotStyle, background: color }} />
      {text}
    </div>
  );
}

function FanIcon({
  size = 24,
  color = "currentColor",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="32" cy="32" r="6" fill={color} />
      <path
        d="M34 26C40 10 55 11 58 22C61 33 47 38 36 34C33 33 32 29 34 26Z"
        fill={color}
      />
      <path
        d="M28 31C11 28 7 14 17 8C27 2 36 14 34 26C33 29 31 32 28 31Z"
        fill={color}
      />
      <path
        d="M31 38C42 51 36 63 25 62C14 61 15 46 27 35C30 33 33 35 31 38Z"
        fill={color}
      />
    </svg>
  );
}

function WifiIcon({
  size = 16,
  color = "currentColor",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M8 24C21 12 43 12 56 24"
        stroke={color}
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="M18 34C26 27 38 27 46 34"
        stroke={color}
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="M27 44C30 41 34 41 37 44"
        stroke={color}
        strokeWidth="7"
        strokeLinecap="round"
      />
      <circle cx="32" cy="53" r="4" fill={color} />
    </svg>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100dvh",
  background: "#f8fafc",
  color: "#0f172a",
};

const screenStyle: CSSProperties = {
  maxWidth: 560,
  margin: "0 auto",
  padding: "10px",
};

const headerStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "42px 1fr 78px",
  alignItems: "center",
  marginBottom: 10,
};

const menuButtonStyle: CSSProperties = {
  border: "none",
  background: "transparent",
  fontSize: 30,
  color: "#0f172a",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: "clamp(28px,7vw,40px)",
  fontWeight: 950,
  lineHeight: 1,
};

const subtitleStyle: CSSProperties = {
  marginTop: 4,
  fontSize: "clamp(14px,4vw,20px)",
  color: "#64748b",
  fontWeight: 700,
};

const themeButtonStyle: CSSProperties = {
  border: "1px solid #e5e7eb",
  background: "white",
  borderRadius: 999,
  height: 38,
  fontSize: 18,
  boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
};

const summaryGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: 6,
  marginBottom: 10,
};

const summaryCardStyle: CSSProperties = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: "8px 4px",
  textAlign: "center",
  minHeight: 78,
  boxShadow: "0 5px 14px rgba(15,23,42,0.05)",
};

const summaryIconStyle: CSSProperties = {
  height: 30,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 24,
  lineHeight: 1,
};

const summaryLabelStyle: CSSProperties = {
  marginTop: 4,
  fontSize: "clamp(10px,2.8vw,13px)",
  color: "#64748b",
  fontWeight: 800,
  lineHeight: 1.1,
};

const summaryValueStyle: CSSProperties = {
  marginTop: 4,
  fontSize: "clamp(20px,5vw,28px)",
  fontWeight: 950,
  lineHeight: 1,
};

const tableWrapStyle: CSSProperties = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  overflow: "hidden",
  boxShadow: "0 8px 22px rgba(15,23,42,0.06)",
};

const tableHeaderStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.35fr 0.72fr 0.72fr 0.72fr",
  background: "#f1f5f9",
  borderBottom: "1px solid #e5e7eb",
};

const headCellLeftStyle: CSSProperties = {
  padding: "10px 8px",
  fontSize: "clamp(13px,3.4vw,16px)",
  fontWeight: 950,
};

const headCellStyle: CSSProperties = {
  padding: "10px 2px",
  fontSize: "clamp(14px,3.4vw,17px)",
  fontWeight: 950,
  textAlign: "center",
  borderLeft: "1px solid #e5e7eb",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const rowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.35fr 0.72fr 0.72fr 0.72fr",
  minHeight: 86,
  color: "#0f172a",
  textDecoration: "none",
  borderBottom: "1px solid #e5e7eb",
};

const departmentCellStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  padding: "8px 6px",
  minWidth: 0,
};

const iconCircleStyle: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 999,
  display: "grid",
  placeItems: "center",
  color: "white",
  flex: "0 0 auto",
};

const nameStyle: CSSProperties = {
  fontSize: "clamp(13px,3.7vw,18px)",
  fontWeight: 950,
  lineHeight: 1.05,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const noteStyle: CSSProperties = {
  fontSize: 10,
  color: "#64748b",
  marginTop: 1,
};

const statusStyle: CSSProperties = {
  marginTop: 4,
  display: "flex",
  alignItems: "center",
  gap: 5,
  fontSize: "clamp(10px,2.8vw,13px)",
  color: "#64748b",
  fontWeight: 800,
};

const wifiStyle: CSSProperties = {
  marginTop: 3,
  display: "flex",
  alignItems: "center",
  gap: 5,
  fontSize: "clamp(10px,2.8vw,13px)",
  color: "#475569",
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const dotStyle: CSSProperties = {
  width: 9,
  height: 9,
  borderRadius: 999,
  display: "inline-block",
  flex: "0 0 auto",
};

const valueCellStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  textAlign: "center",
  borderLeft: "1px solid #e5e7eb",
  padding: "4px 2px",
  minWidth: 0,
};

const mainValueStyle: CSSProperties = {
  fontSize: "clamp(14px,4vw,20px)",
  fontWeight: 950,
  lineHeight: 1.1,
  whiteSpace: "nowrap",
};

const minMaxStyle: CSSProperties = {
  marginTop: 5,
  fontSize: "clamp(10px,2.9vw,14px)",
  fontWeight: 850,
  whiteSpace: "nowrap",
};

const legendStyle: CSSProperties = {
  marginTop: 10,
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: "8px",
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: 4,
};

const legendItemStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
  fontSize: "clamp(10px,2.8vw,13px)",
  fontWeight: 800,
  color: "#475569",
};

const legendDotStyle: CSSProperties = {
  width: 9,
  height: 9,
  borderRadius: 999,
  display: "inline-block",
  flex: "0 0 auto",
};

const bottomNavStyle: CSSProperties = {
  marginTop: 10,
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  overflow: "hidden",
};

const bottomNavItemStyle: CSSProperties = {
  textAlign: "center",
  padding: "11px 6px",
  color: "#0f172a",
  textDecoration: "none",
  fontWeight: 950,
  fontSize: "clamp(12px,3.2vw,15px)",
  borderLeft: "1px solid #e5e7eb",
};

const loadingStyle: CSSProperties = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 20,
  textAlign: "center",
  fontWeight: 800,
};