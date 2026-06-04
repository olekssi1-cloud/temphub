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

const sensorSubtitles: Record<number, string> = {
  7: "(без вентилятора)",
};

const allIds = [1, 2, 3, 4, 5, 6, 7];

function getSensorIcon(id: number) {
  if (id === 7) return "🏠";
  return "🌀";
}

function getStatusDot(online: boolean) {
  return online ? "#00b83f" : "#ef0000";
}

function formatNumber(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "0.0";
  }

  return Number(value).toFixed(digits);
}

export default function HomePage() {
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/home-summary", {
          cache: "no-store",
        });

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
        }
      );
    });
  }, [sensors]);

  const total = rows.length;
  const onlineCount = rows.filter((s) => s.online).length;
  const manualCount = rows.filter((s) => s.mode === "manual").length;
  const problemCount = rows.filter((s) => !s.online).length;

  return (
    <main style={pageStyle}>
      <div style={screenStyle}>
        <header style={headerStyle}>
          <button style={menuButtonStyle}>☰</button>

          <div style={{ textAlign: "center" }}>
            <h1 style={titleStyle}>Вентиляція</h1>
            <div style={subtitleStyle}>Список відділів</div>
          </div>

          <button style={themeButtonStyle}>☀️ 🌙</button>
        </header>

        <section style={summaryGridStyle}>
          <SummaryCard icon="🌀" label="Всього відділів" value={total} />
          <SummaryCard icon="📶" label="Онлайн" value={onlineCount} />
          <SummaryCard icon="✋" label="Ручне керування" value={manualCount} />
          <SummaryCard icon="⚠️" label="Проблеми" value={problemCount} danger />
        </section>

        {loading ? (
          <div style={loadingStyle}>Завантаження...</div>
        ) : (
          <section style={tableWrapStyle}>
            <div style={tableHeaderStyle}>
              <div style={departmentHeaderStyle}>
                <b>Відділ</b>
                <span>(натисніть для деталей)</span>
              </div>

              <div style={columnHeaderStyle}>🌡 Температура</div>
              <div style={columnHeaderStyle}>💧 Вологість</div>
              <div style={columnHeaderStyle}>🌀 Двигун</div>
            </div>

            {rows.map((sensor) => {
              const isYard = sensor.id === 7;
              const isManual = sensor.mode === "manual";

              return (
                <Link
                  key={sensor.id}
                  href={`/chart/${sensor.id}`}
                  style={rowStyle}
                >
                  <div style={departmentCellStyle}>
                    <div
                      style={{
                        ...roundIconStyle,
                        background: isYard
                          ? "linear-gradient(135deg,#dcfce7,#86efac)"
                          : sensor.online
                            ? "linear-gradient(135deg,#60a5fa,#0284c7)"
                            : "linear-gradient(135deg,#9ca3af,#374151)",
                      }}
                    >
                      {getSensorIcon(sensor.id)}
                    </div>

                    <div>
                      <div style={nameStyle}>
                        {sensorNames[sensor.id] ?? `Відділ ${sensor.id}`}
                      </div>

                      {sensorSubtitles[sensor.id] && (
                        <div style={smallNoteStyle}>
                          {sensorSubtitles[sensor.id]}
                        </div>
                      )}

                      <div style={statusStyle}>
                        <span
                          style={{
                            ...statusDotStyle,
                            background: getStatusDot(sensor.online),
                          }}
                        />
                        {sensor.online ? "Онлайн" : "Офлайн"}
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
                      {formatNumber(sensor.temp)}°C
                    </div>
                    <div style={minMaxStyle}>
                      <span style={{ color: "#006bd6" }}>
                        {formatNumber(sensor.min24)}
                      </span>{" "}
                      /{" "}
                      <span style={{ color: "#e00000" }}>
                        {formatNumber(sensor.max24)}
                      </span>
                    </div>
                  </div>

                  <div style={valueCellStyle}>
                    <div
                      style={{
                        ...mainValueStyle,
                        color: sensor.online ? "#0f172a" : "#dc2626",
                      }}
                    >
                      {formatNumber(sensor.humidity)}%
                    </div>
                    <div style={minMaxStyle}>
                      <span style={{ color: "#006bd6" }}>0.0</span> /{" "}
                      <span style={{ color: "#e00000" }}>
                        {formatNumber(sensor.humidity)}
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
                            color: isManual ? "#f59e0b" : "#00a832",
                          }}
                        >
                          {isManual ? "Ручне" : `${Math.round(sensor.rpm)}%`}
                        </div>
                        <div style={minMaxStyle}>
                          {sensor.online ? "10% / 100%" : "0% / 0%"}
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
          <div>
            <LegendItem color="#00b83f" text="Онлайн — відділ працює та на звʼязку" />
            <LegendItem color="#ef0000" text="Офлайн — немає звʼязку з відділом" />
            <LegendItem color="#f59e0b" text="Ручне — ручне керування двигуном" />
            <LegendItem color="#00a832" text="% — автоматичне керування двигуном" />
          </div>

          <div style={infoTextStyle}>
            ⓘ Натисніть на рядок відділу, щоб відкрити детальний графік.
          </div>
        </section>

        <nav style={bottomNavStyle}>
          <Link href="/" style={{ ...bottomNavItemStyle, color: "#7c3aed" }}>
            🏠
            <br />
            Головна
          </Link>

          <Link href="/disconnects" style={bottomNavItemStyle}>
            ⏻
            <br />
            Відключення
          </Link>

          <Link href="/fan-settings" style={bottomNavItemStyle}>
            🎛️
            <br />
            Керування
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
      <div>
        <div style={summaryLabelStyle}>{label}</div>
        <div style={summaryValueStyle}>{value}</div>
      </div>
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
  maxWidth: 980,
  margin: "0 auto",
  padding: "10px 12px 12px",
};

const headerStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "52px 1fr 110px",
  alignItems: "center",
  marginBottom: 12,
};

const menuButtonStyle: CSSProperties = {
  border: "none",
  background: "transparent",
  fontSize: 34,
  color: "#0f172a",
  cursor: "pointer",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: "clamp(28px, 5vw, 42px)",
  fontWeight: 950,
  lineHeight: 1,
};

const subtitleStyle: CSSProperties = {
  marginTop: 5,
  fontSize: "clamp(16px, 3vw, 22px)",
  color: "#334155",
};

const themeButtonStyle: CSSProperties = {
  border: "1px solid #e5e7eb",
  background: "white",
  borderRadius: 999,
  height: 44,
  fontSize: 23,
  boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
};

const summaryGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: 12,
  marginBottom: 14,
};

const summaryCardStyle: CSSProperties = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 14,
  display: "flex",
  alignItems: "center",
  gap: 12,
  minHeight: 82,
};

const summaryIconStyle: CSSProperties = {
  width: 46,
  height: 46,
  borderRadius: 999,
  display: "grid",
  placeItems: "center",
  fontSize: 28,
  background: "#eff6ff",
};

const summaryLabelStyle: CSSProperties = {
  fontSize: 15,
  lineHeight: 1.2,
};

const summaryValueStyle: CSSProperties = {
  fontSize: 32,
  fontWeight: 950,
  lineHeight: 1,
  marginTop: 4,
};

const tableWrapStyle: CSSProperties = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  overflow: "hidden",
};

const tableHeaderStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.35fr 1fr 1fr 1fr",
  background: "#f8fafc",
  borderBottom: "1px solid #e5e7eb",
};

const departmentHeaderStyle: CSSProperties = {
  padding: 16,
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontSize: 18,
};

const columnHeaderStyle: CSSProperties = {
  padding: 16,
  fontWeight: 900,
  fontSize: 15,
  textAlign: "center",
  borderLeft: "1px solid #e5e7eb",
};

const rowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.35fr 1fr 1fr 1fr",
  minHeight: 92,
  color: "#0f172a",
  textDecoration: "none",
  borderBottom: "1px solid #e5e7eb",
};

const departmentCellStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: 14,
};

const roundIconStyle: CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: 999,
  display: "grid",
  placeItems: "center",
  color: "white",
  fontSize: 25,
  flex: "0 0 auto",
};

const nameStyle: CSSProperties = {
  fontSize: 22,
  fontWeight: 950,
  lineHeight: 1.1,
};

const smallNoteStyle: CSSProperties = {
  fontSize: 12,
  color: "#334155",
  marginTop: 2,
};

const statusStyle: CSSProperties = {
  marginTop: 5,
  display: "flex",
  alignItems: "center",
  gap: 7,
  fontSize: 14,
};

const statusDotStyle: CSSProperties = {
  width: 11,
  height: 11,
  borderRadius: 999,
  display: "inline-block",
};

const valueCellStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  textAlign: "center",
  borderLeft: "1px solid #e5e7eb",
  padding: "8px 6px",
};

const mainValueStyle: CSSProperties = {
  fontSize: 24,
  fontWeight: 950,
  lineHeight: 1.1,
};

const minMaxStyle: CSSProperties = {
  marginTop: 6,
  fontSize: 16,
  fontWeight: 800,
};

const legendStyle: CSSProperties = {
  marginTop: 14,
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 14,
  display: "grid",
  gridTemplateColumns: "1.2fr 1fr",
  gap: 14,
  alignItems: "center",
};

const legendItemStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 15,
  marginBottom: 5,
};

const legendDotStyle: CSSProperties = {
  width: 11,
  height: 11,
  borderRadius: 999,
  display: "inline-block",
  flex: "0 0 auto",
};

const infoTextStyle: CSSProperties = {
  borderLeft: "1px solid #e5e7eb",
  paddingLeft: 20,
  fontSize: 16,
  color: "#334155",
  lineHeight: 1.45,
};

const bottomNavStyle: CSSProperties = {
  marginTop: 14,
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  overflow: "hidden",
};

const bottomNavItemStyle: CSSProperties = {
  textAlign: "center",
  padding: "12px 6px",
  color: "#0f172a",
  textDecoration: "none",
  fontWeight: 900,
  fontSize: 15,
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