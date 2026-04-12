"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Sensor = {
  id: number;
  temp: number;
  updatedAt: string | null;
  min24: number;
  max24: number;
  online: boolean;
  rpm?: number;
};

type HomeSummaryResponse = {
  sensors: Sensor[];
  onlineCount: number;
  totalCount: number;
};

const sensorTitles: Record<number, string> = {
  1: "Опорос",
  2: "Супорос 1",
  3: "Супорос 2",
  4: "Супорос 3",
  5: "Відгодівля",
  6: "Дорощування",
  7: "Рем свинки",
  8: "Двір",
};

function formatTemp(value: number) {
  return `${value.toFixed(1)}°C`;
}

function MiniChart({ online }: { online: boolean }) {
  return (
    <div
      style={{
        height: 54,
        borderRadius: 14,
        background: "rgba(255,255,255,0.04)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: online ? "#7fe0ff" : "#ffb3b3",
        fontSize: 13,
        fontWeight: 700,
      }}
    >
      24h
    </div>
  );
}

function SensorCard({ sensor }: { sensor: Sensor }) {
  const title = sensorTitles[sensor.id] ?? `Сенсор ${sensor.id}`;
  const offline = !sensor.online;

  return (
    <div
      style={{
        background: offline
          ? "linear-gradient(180deg,#5b1d28,#41151c)"
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
        <strong style={{ fontSize: 20 }}>{title}</strong>

        <strong style={{ fontSize: 20 }}>
          {offline ? "0.0°C" : formatTemp(sensor.temp)}
        </strong>

        <span>💧 0%</span>
        <span>🌀 {sensor.rpm ?? 0}%</span>

        <Link
          href={`/chart/${sensor.id}`}
          style={{
            color: "#dff6ff",
            textDecoration: "none",
            fontWeight: 700,
          }}
        >
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
            Min {offline ? "0.0" : sensor.min24.toFixed(1)} • Max{" "}
            {offline ? "0.0" : sensor.max24.toFixed(1)}
          </div>

          <Link
            href={`/disconnects/${sensor.id}`}
            style={{
              display: "inline-block",
              marginTop: 8,
              padding: "10px 14px",
              borderRadius: 12,
              background: "rgba(87,198,255,0.18)",
              color: "white",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            Відключення
          </Link>

          {offline && (
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
              Очікує сенсор
            </div>
          )}
        </div>

        <MiniChart online={!offline} />
      </div>
    </div>
  );
}

export default function Page() {
  const [data, setData] = useState<HomeSummaryResponse | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/home-summary", {
          cache: "no-store",
        });
        const json = await res.json();
        setData(json);
      } catch (error) {
        console.error("home-summary load error", error);
      }
    }

    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);

  const sensors = useMemo(() => {
    if (!data?.sensors) {
      return Array.from({ length: 8 }, (_, i) => ({
        id: i + 1,
        temp: 0,
        updatedAt: null,
        min24: 0,
        max24: 0,
        online: false,
        rpm: 0,
      }));
    }

    const map = new Map(data.sensors.map((s) => [s.id, s]));
    return Array.from({ length: 8 }, (_, i) => {
      const id = i + 1;
      return (
        map.get(id) ?? {
          id,
          temp: 0,
          updatedAt: null,
          min24: 0,
          max24: 0,
          online: false,
          rpm: 0,
        }
      );
    });
  }, [data]);

  const onlineCount = data?.onlineCount ?? 0;
  const totalCount = data?.totalCount ?? 8;

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
            <div>
              {totalCount} відділів • {onlineCount} онлайн
            </div>
          </div>
        </header>

        <div style={{ display: "grid", gap: 14 }}>
          {sensors.map((sensor) => (
            <SensorCard key={sensor.id} sensor={sensor} />
          ))}
        </div>
      </div>
    </main>
  );
}