"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Sensor = {
  id: number;
  title: string;
  temp: number;
  min24: number;
  max24: number;
  updatedAt: string | null;
  connected: boolean;
};

const initialSensors: Sensor[] = [
  { id: 1, title: "Опорос", temp: 0, min24: 0, max24: 0, updatedAt: null, connected: false },
  { id: 2, title: "Супорос 1", temp: 0, min24: 0, max24: 0, updatedAt: null, connected: false },
  { id: 3, title: "Супорос 2", temp: 0, min24: 0, max24: 0, updatedAt: null, connected: false },
  { id: 4, title: "Супорос 3", temp: 0, min24: 0, max24: 0, updatedAt: null, connected: false },
  { id: 5, title: "Відгодівля", temp: 0, min24: 0, max24: 0, updatedAt: null, connected: false },
  { id: 6, title: "Дорощювання", temp: 0, min24: 0, max24: 0, updatedAt: null, connected: false },
  { id: 7, title: "Рем свинки", temp: 0, min24: 0, max24: 0, updatedAt: null, connected: false },
  { id: 8, title: "Двір", temp: 0, min24: 0, max24: 0, updatedAt: null, connected: false },
];

function isOffline(sensor: Sensor) {
  if (!sensor.updatedAt) return false;
  return Date.now() - new Date(sensor.updatedAt).getTime() > 180000;
}

export default function Page() {
  const [sensors, setSensors] = useState(initialSensors);

  useEffect(() => {
    async function loadSensor1() {
      try {
        const [latestRes, historyRes] = await Promise.all([
          fetch("/api/latest", { cache: "no-store" }),
          fetch("/api/history?range=24h", { cache: "no-store" }),
        ]);

        const latest = await latestRes.json();
        const history = await historyRes.json();

        const temps = Array.isArray(history)
          ? history
              .map((item: any) => Number(item.temp))
              .filter((v: number) => !Number.isNaN(v))
          : [];

        const min24 = temps.length ? Math.min(...temps) : 0;
        const max24 = temps.length ? Math.max(...temps) : 0;

        setSensors((prev) =>
          prev.map((sensor) =>
            sensor.id === 1
              ? {
                  ...sensor,
                  temp: Number(latest.temp || 0),
                  updatedAt: latest.time || latest.updatedAt || null,
                  connected: true,
                  min24,
                  max24,
                }
              : sensor
          )
        );
      } catch (error) {
        console.error("Load sensor error:", error);
      }
    }

    loadSensor1();
    const timer = setInterval(loadSensor1, 5000);

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
        background: "linear-gradient(180deg,#081225,#0b1630)",
        padding: 16,
      }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            gap: 16,
            alignItems: "center",
            padding: 18,
            borderRadius: 24,
            background: "linear-gradient(90deg,#1846a3,#1cb8da)",
            color: "white",
            marginBottom: 18,
          }}
        >
          <div
            style={{
              width: 70,
              height: 70,
              borderRadius: 20,
              overflow: "hidden",
              background: "white",
            }}
          >
            <Image src="/logo.png" alt="logo" width={70} height={70} />
          </div>

          <div>
            <div style={{ fontSize: 42, fontWeight: 900 }}>Міщенки</div>
            <div>8 відділів • {onlineCount} онлайн</div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          {sensors.map((sensor) => {
            const offline = isOffline(sensor);

            return (
              <div
                key={sensor.id}
                style={{
                  background: offline
                    ? "linear-gradient(180deg,#5b1f2b,#41151d)"
                    : "linear-gradient(180deg,#112251,#0b183d)",
                  borderRadius: 24,
                  padding: 18,
                  color: "white",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto auto",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <strong style={{ fontSize: 22 }}>{sensor.title}</strong>

                  <strong style={{ fontSize: 22 }}>
                    {offline ? "0.0°C" : `${sensor.temp.toFixed(1)}°C`}
                  </strong>

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

                <div style={{ marginTop: 12, fontSize: 18 }}>
                  Min {sensor.min24.toFixed(1)} • Max {sensor.max24.toFixed(1)}
                </div>

                <Link
                  href={`/disconnects/${sensor.id}`}
                  style={{
                    display: "inline-block",
                    marginTop: 12,
                    padding: "10px 16px",
                    borderRadius: 12,
                    background: "rgba(87,198,255,0.18)",
                    color: "white",
                    textDecoration: "none",
                    fontWeight: 700,
                  }}
                >
                  Відключення
                </Link>

                {sensor.id !== 1 && (
                  <div style={{ marginTop: 10, opacity: 0.7 }}>
                    Очікує сенсор
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}