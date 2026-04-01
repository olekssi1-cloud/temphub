"use client";

import { useEffect, useState } from "react";
import TemperatureChart from "./components/TemperatureChart";

type LatestData = {
  temp: number | null;
  status: string;
  updated: string;
  device: string;
  min24h?: number | null;
  max24h?: number | null;
};

type Point = {
  temp: number;
  time: string;
};

export default function HomePage() {
  const [latest, setLatest] = useState<LatestData>({
    temp: null,
    status: "loading",
    updated: "...",
    device: "A1",
    min24h: null,
    max24h: null,
  });

  const [points, setPoints] = useState<Point[]>([]);
  const [range, setRange] = useState("24h");

  async function loadLatest() {
    try {
      const latestRes = await fetch("/api/latest", { cache: "no-store" });
      const latestJson = await latestRes.json();

      const tempRes = await fetch("/api/temperature", { cache: "no-store" });
      const tempJson = await tempRes.json();

      setLatest({
        temp: latestJson.temp,
        status: latestJson.status,
        updated: latestJson.updated,
        device: latestJson.device || "A1",
        min24h: tempJson.min24h,
        max24h: tempJson.max24h,
      });
    } catch {
      setLatest({
        temp: null,
        status: "error",
        updated: "помилка",
        device: "A1",
        min24h: null,
        max24h: null,
      });
    }
  }

  async function loadHistory(selectedRange: string) {
    try {
      const res = await fetch("/api/history?range=" + selectedRange, {
        cache: "no-store",
      });
      const json = await res.json();

      if (Array.isArray(json)) {
        setPoints(json);
      } else {
        setPoints([]);
      }
    } catch {
      setPoints([]);
    }
  }

  useEffect(() => {
    loadLatest();
    loadHistory(range);
  }, [range]);

  useEffect(() => {
    const timer = setInterval(() => {
      loadLatest();
      loadHistory(range);
    }, 15000);

    return () => clearInterval(timer);
  }, [range]);

  function formatTemp(value: number | null | undefined) {
    if (value === null || value === undefined) return "--°C";
    return value.toFixed(1) + "°C";
  }

  function statusText(value: string) {
    if (value === "online") return "Онлайн";
    if (value === "no_data") return "Немає даних";
    if (value === "error") return "Помилка";
    return value;
  }

  const rangeButtons = ["1h", "10h", "24h", "5d", "10d"];

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#041126",
        color: "#ffffff",
        padding: "24px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: "720px", margin: "0 auto" }}>
        <div
          style={{
            background: "linear-gradient(90deg, #1d4ed8 0%, #06b6d4 100%)",
            borderRadius: "28px",
            padding: "28px",
            display: "flex",
            alignItems: "center",
            gap: "20px",
            marginBottom: "28px",
          }}
        >
          <div
            style={{
              width: "78px",
              height: "78px",
              borderRadius: "999px",
              background: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            <img
              src="/logo.png"
              alt="Logo"
              style={{ width: "58px", height: "58px", objectFit: "contain" }}
            />
          </div>

          <div>
            <div
              style={{
                fontSize: "34px",
                fontWeight: 700,
                marginBottom: "10px",
              }}
            >
              Міщенки
            </div>

            <div
              style={{
                fontSize: "20px",
                lineHeight: 1.35,
                color: "rgba(255,255,255,0.95)",
              }}
            >
              Температура, статус сенсора і межі за 24 години
            </div>
          </div>
        </div>

        <div
          style={{
            background: "#08b536",
            borderRadius: "28px",
            padding: "34px 24px",
            textAlign: "center",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              fontSize: "72px",
              fontWeight: 700,
              lineHeight: 1,
              marginBottom: "18px",
            }}
          >
            {formatTemp(latest.temp)}
          </div>

          <div style={{ fontSize: "24px" }}>{statusText(latest.status)}</div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "18px",
            marginBottom: "26px",
          }}
        >
          <div
            style={{
              background: "#059b35",
              borderRadius: "22px",
              padding: "28px 20px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "24px", marginBottom: "10px" }}>MIN 24h</div>
            <div style={{ fontSize: "34px", fontWeight: 700 }}>
              {formatTemp(latest.min24h)}
            </div>
          </div>

          <div
            style={{
              background: "#e00000",
              borderRadius: "22px",
              padding: "28px 20px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "24px", marginBottom: "10px" }}>MAX 24h</div>
            <div style={{ fontSize: "34px", fontWeight: 700 }}>
              {formatTemp(latest.max24h)}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: "14px",
            marginBottom: "26px",
            flexWrap: "wrap",
          }}
        >
          {rangeButtons.map((item) => {
            const active = range === item;

            return (
              <button
                key={item}
                onClick={() => setRange(item)}
                style={{
                  minWidth: "92px",
                  height: "68px",
                  borderRadius: "24px",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "22px",
                  color: "#ffffff",
                  background: active ? "#15c5f5" : "#1b2740",
                }}
              >
                {item}
              </button>
            );
          })}
        </div>

        <div
          style={{
            background: "#101b32",
            borderRadius: "28px",
            padding: "24px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
              marginBottom: "14px",
            }}
          >
            <div style={{ fontSize: "28px", fontWeight: 700 }}>
              Історія температури
            </div>

            <button
              onClick={() => loadHistory(range)}
              style={{
                background: "transparent",
                color: "#d1d5db",
                border: "1px solid #4b5563",
                borderRadius: "999px",
                padding: "12px 20px",
                fontSize: "16px",
                cursor: "pointer",
              }}
            >
              Скинути zoom
            </button>
          </div>

          <div
            style={{
              color: "#b7c0d1",
              fontSize: "17px",
              lineHeight: 1.45,
              marginBottom: "18px",
            }}
          >
            Масштабуй пальцями, рухай графік вліво/вправо.
          </div>

          <TemperatureChart points={points} />
        </div>
      </div>
    </main>
  );
}