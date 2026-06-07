"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

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
  wifi_level?: number;
  wifiLevel?: number;
  wifi_rssi?: number;
  wifiRssi?: number;
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
  const level = Number(raw);

  if (Number.isNaN(level)) return 0;
  return Math.max(0, Math.min(10, Math.round(level)));
}

function getWifiColor(level: number) {
  if (level >= 8) return "#16a34a";
  if (level >= 5) return "#eab308";
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

  const total = 6;
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
          <SummaryCard icon="✺" label="Всього" value={total} />
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
              <div style={headCellStyle}>✺</div>
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
                        ...iconStyle,
                        background: isYard
                          ? "linear-gradient(135deg,#86efac,#22c55e)"
                          : sensor.online
                            ? "linear-gradient(135deg,#60a5fa,#0284c7)"
                            : "linear-gradient(135deg,#9ca3af,#374151)",
                      }}
                    >
                      {isYard ? "🏠" : "✺"}
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

                      <div style={{ ...wifiStyle, color: wifiColor }}>
                        📶 Wi-Fi: {wifiLevel}
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
                        <div style={minMaxStyle}>
                          {sensor.online ? "10/100" : "0/0"}
                        </div>
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
  icon: string;
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

const iconStyle: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 999,
  display: "grid",
  placeItems: "center",
  color: "white",
  fontSize: 19,
  fontWeight: 900,
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
  fontSize: "clamp(10px,2.8vw,13px)",
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