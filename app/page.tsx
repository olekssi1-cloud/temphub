"use client";

import { useEffect, useState } from "react";

type TempItem = {
  device_id: string;
  temperature: number;
  sensor_ok: boolean;
  time: string;
  min12h?: number | null;
  max12h?: number | null;
};

const OFFLINE_TIMEOUT_MS = 10000;

export default function Home() {
  const [latest, setLatest] = useState<TempItem | null>(null);
  const [now, setNow] = useState(Date.now());

  async function loadData() {
    try {
      const res = await fetch("/api/temperature", {
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error("Failed to fetch");
      }

      const json = await res.json();

      if (Array.isArray(json) && json.length > 0) {
        setLatest(json[0]);
      } else {
        setLatest(null);
      }
    } catch (error) {
      console.log("Fetch error:", error);
    }
  }

  useEffect(() => {
    loadData();

    const dataInterval = setInterval(loadData, 2000);
    const clockInterval = setInterval(() => setNow(Date.now()), 1000);

    return () => {
      clearInterval(dataInterval);
      clearInterval(clockInterval);
    };
  }, []);

  const latestTime = latest ? new Date(latest.time).getTime() : 0;
  const isOffline = !latest || now - latestTime > OFFLINE_TIMEOUT_MS;

  const currentTemp = !latest || isOffline ? 0 : Number(latest.temperature ?? 0);
  const currentSensorOk = !!latest && !isOffline && !!latest.sensor_ok;

  const min12h =
    latest && latest.min12h !== undefined && latest.min12h !== null
      ? Number(latest.min12h).toFixed(1)
      : "--";

  const max12h =
    latest && latest.max12h !== undefined && latest.max12h !== null
      ? Number(latest.max12h).toFixed(1)
      : "--";

  const statusText = isOffline
    ? "Немає зв'язку"
    : currentSensorOk
    ? "Норма"
    : "Помилка";

  const statusBg = isOffline
    ? "rgba(148, 163, 184, 0.18)"
    : currentSensorOk
    ? "rgba(34, 197, 94, 0.16)"
    : "rgba(239, 68, 68, 0.16)";

  const statusColor = isOffline
    ? "#cbd5e1"
    : currentSensorOk
    ? "#22c55e"
    : "#f87171";

  const tempColor = isOffline ? "#e2e8f0" : currentTemp >= 34 ? "#f87171" : "#22c55e";

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, rgba(37,99,235,0.18), transparent 28%), linear-gradient(180deg, #071127 0%, #081224 45%, #030712 100%)",
        color: "#f8fafc",
        fontFamily: "Arial, sans-serif",
        padding: "26px 14px 40px",
      }}
    >
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div
          style={{
            background:
              "linear-gradient(135deg, rgba(59,130,246,0.30), rgba(15,23,42,0.95) 55%, rgba(20,184,166,0.18))",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 28,
            padding: 22,
            boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
            marginBottom: 18,
          }}
        >
          <div style={{ color: "#bfdbfe", fontSize: 13, marginBottom: 10 }}>
            Mobile monitoring
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 12,
            }}
          >
            <div style={{ fontSize: 32 }}>🌡️</div>
            <div style={{ fontSize: 34, fontWeight: 800 }}>TempHub</div>
          </div>

          <div style={{ color: "#e2e8f0", fontSize: 15, lineHeight: 1.45 }}>
            Температура, статус сенсора і межі за 12 годин.
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 14,
            marginBottom: 18,
          }}
        >
          <div
            style={{
              borderRadius: 22,
              padding: 18,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div style={{ color: "#cbd5e1", fontSize: 13 }}>Записів</div>
            <div style={{ marginTop: 10, fontSize: 30, fontWeight: 800 }}>
              {latest ? 1 : 0}
            </div>
          </div>

          <div
            style={{
              borderRadius: 22,
              padding: 18,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div style={{ color: "#cbd5e1", fontSize: 13 }}>Середня t°</div>
            <div style={{ marginTop: 10, fontSize: 30, fontWeight: 800 }}>
              {latest && !isOffline ? currentTemp.toFixed(1) : "--"}°C
            </div>
          </div>
        </div>

        <div
          style={{
            borderRadius: 28,
            padding: 20,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 16px 40px rgba(0,0,0,0.28)",
            marginBottom: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "start",
              gap: 12,
              marginBottom: 14,
            }}
          >
            <div>
              <div style={{ color: "#cbd5e1", fontSize: 13 }}>Останній пристрій</div>
              <div style={{ marginTop: 8, fontSize: 24, fontWeight: 800 }}>
                {latest?.device_id || "--"}
              </div>
            </div>

            <div
              style={{
                padding: "10px 14px",
                borderRadius: 999,
                background: statusBg,
                color: statusColor,
                border: `1px solid ${statusColor}55`,
                fontSize: 13,
                fontWeight: 800,
              }}
            >
              {statusText}
            </div>
          </div>

          <div
            style={{
              fontSize: 66,
              lineHeight: 1,
              fontWeight: 900,
              color: tempColor,
              marginBottom: 18,
            }}
          >
            {currentTemp.toFixed(1)}°C
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 14,
              marginBottom: 14,
            }}
          >
            <div
              style={{
                borderRadius: 18,
                padding: 16,
                background: "rgba(255,255,255,0.05)",
              }}
            >
              <div style={{ color: "#cbd5e1", fontSize: 13 }}>Сенсор</div>
              <div style={{ marginTop: 8, fontSize: 18, fontWeight: 800 }}>
                {currentSensorOk ? "Працює" : "Не працює"}
              </div>
            </div>

            <div
              style={{
                borderRadius: 18,
                padding: 16,
                background: "rgba(255,255,255,0.05)",
              }}
            >
              <div style={{ color: "#cbd5e1", fontSize: 13 }}>Оновлено</div>
              <div style={{ marginTop: 8, fontSize: 16, fontWeight: 700 }}>
                {latest ? new Date(latest.time).toLocaleString() : "--"}
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 14,
            }}
          >
            <div
              style={{
                borderRadius: 18,
                padding: 16,
                background: "rgba(34,197,94,0.12)",
                border: "1px solid rgba(34,197,94,0.18)",
              }}
            >
              <div style={{ color: "#d1fae5", fontSize: 13 }}>MIN 12h</div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 24,
                  fontWeight: 800,
                  color: "#4ade80",
                }}
              >
                {min12h}°C
              </div>
            </div>

            <div
              style={{
                borderRadius: 18,
                padding: 16,
                background: "rgba(239,68,68,0.12)",
                border: "1px solid rgba(239,68,68,0.18)",
              }}
            >
              <div style={{ color: "#fecaca", fontSize: 13 }}>MAX 12h</div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 24,
                  fontWeight: 800,
                  color: "#f87171",
                }}
              >
                {max12h}°C
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}