"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type SensorCard = {
  id: number;
  title: string;
  temp: number;
  humidity: number;
  fan: number;
  min24: number;
  max24: number;
  updatedAt: string | null;
  connected: boolean;
};

type LatestApiResponse = {
  temp?: number | null;
  updatedAt?: string | null;
};

const initialSensors: SensorCard[] = [
  { id: 1, title: "Опорос", temp: 0, humidity: 0, fan: 0, min24: 0, max24: 0, updatedAt: null, connected: false },
  { id: 2, title: "Супорос 1", temp: 0, humidity: 0, fan: 0, min24: 0, max24: 0, updatedAt: null, connected: false },
  { id: 3, title: "Супорос 2", temp: 0, humidity: 0, fan: 0, min24: 0, max24: 0, updatedAt: null, connected: false },
  { id: 4, title: "Супорос 3", temp: 0, humidity: 0, fan: 0, min24: 0, max24: 0, updatedAt: null, connected: false },
  { id: 5, title: "Відгодівля", temp: 0, humidity: 0, fan: 0, min24: 0, max24: 0, updatedAt: null, connected: false },
  { id: 6, title: "Дорощювання", temp: 0, humidity: 0, fan: 0, min24: 0, max24: 0, updatedAt: null, connected: false },
  { id: 7, title: "Рем свинки", temp: 0, humidity: 0, fan: 0, min24: 0, max24: 0, updatedAt: null, connected: false },
  { id: 8, title: "Двір", temp: 0, humidity: 0, fan: 0, min24: 0, max24: 0, updatedAt: null, connected: false },
];

function isOffline(sensor: SensorCard) {
  if (!sensor.connected || !sensor.updatedAt) return false;
  return Date.now() - new Date(sensor.updatedAt).getTime() > 60_000;
}

function MiniChart({ offline }: { offline: boolean }) {
  return (
    <div
      style={{
        height: 54,
        borderRadius: 12,
        background: "rgba(255,255,255,0.04)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: offline ? "#ffb3b3" : "#77d8ff",
        fontSize: 13,
      }}
    >
      24h
    </div>
  );
}

function Card({ sensor }: { sensor: SensorCard }) {
  const offline = isOffline(sensor);

  return (
    <div
      style={{
        background: offline
          ? "linear-gradient(180deg,#5c1e28,#41151c)"
          : "linear-gradient(180deg,#10214f,#0b183d)",
        borderRadius: 24,
        padding: 18,
        color: "white",
        boxShadow: "0 10px 24px rgba(0,0,0,0.22)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto auto auto auto",
          gap: 10,
          alignItems: "center",
        }}
      >
        <strong>{sensor.title}</strong>
        <strong>{offline ? "0.0°C" : `${sensor.temp.toFixed(1)}°C`}</strong>
        <span>💧 {offline ? 0 : sensor.humidity}%</span>
        <span>🌀 {offline ? 0 : sensor.fan}%</span>
        <Link href={`/chart/${sensor.id}`} style={{ color: "#dff6ff", textDecoration: "none" }}>
          Графік
        </Link>
      </div>

      <div
        style={{
          marginTop: 10,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
        }}
      >
        <div>
          <div style={{ fontSize: 14 }}>
            Min {sensor.min24.toFixed(1)} • Max {sensor.max24.toFixed(1)}
          </div>

          <Link
            href={`/disconnects/${sensor.id}`}
            style={{
              display: "inline-block",
              marginTop: 8,
              padding: "8px 12px",
              borderRadius: 10,
              background: "rgba(87,198,255,0.18)",
              color: "white",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            Відключення
          </Link>

          {!sensor.connected && (
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
              Очікує сенсор
            </div>
          )}
        </div>

        <MiniChart offline={offline} />
      </div>
    </div>
  );
}

export default function Page() {
  const [sensors, setSensors] = useState(initialSensors);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/latest", { cache: "no-store" });
        const data: LatestApiResponse = await res.json();

        setSensors((prev) =>
          prev.map((sensor) =>
            sensor.id === 1
              ? {
                  ...sensor,
                  temp: typeof data.temp === "number" ? data.temp : 0,
                  updatedAt: data.updatedAt ?? null,
                  connected: !!data.updatedAt || typeof data.temp === "number",
                }
              : sensor
          )
        );
      } catch (e) {
        console.error(e);
      }
    }

    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);

  const onlineCount = useMemo(
    () => sensors.filter((s) => s.connected && !isOffline(s)).length,
    [sensors]
  );

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg,#091225,#0c1630)",
        padding: 16,
      }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: 18,
            borderRadius: 24,
            background: "linear-gradient(90deg,#143f9c,#16b5d8)",
            color: "white",
            marginBottom: 18,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 20,
              overflow: "hidden",
              background: "white",
            }}
          >
            <Image src="/logo.png" alt="logo" width={64} height={64} />
          </div>

          <div>
            <div style={{ fontSize: 42, fontWeight: 900 }}>Міщенки</div>
            <div>8 відділів • {onlineCount} онлайн</div>
          </div>
        </header>

        <div style={{ display: "grid", gap: 14 }}>
          {sensors.map((sensor) => (
            <Card key={sensor.id} sensor={sensor} />
          ))}
        </div>
      </div>
    </main>
  );
}