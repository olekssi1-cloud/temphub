"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Sensor = {
  id: number;
  temp: number;
  updatedAt: string | null;
  min24: number;
  max24: number;
  online: boolean;
  rpm: number;
};

const sensorNames: Record<number, string> = {
  1: "Опорос",
  2: "Супорос 1",
  3: "Супорос 2",
  4: "Супорос 3",
  5: "Відгодівля",
  6: "Дорощювання",
  7: "Рем свинки",
  8: "Двір",
};

export default function HomePage() {
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const res = await fetch("/api/home-summary", {
        cache: "no-store",
      });

      const json = await res.json();

      if (!cancelled) {
        setSensors(json.sensors ?? []);
        setLoading(false);
      }
    }

    load();
    const timer = setInterval(load, 2000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg,#091225,#0c1630)",
        color: "white",
        padding: 20,
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <h1 style={{ fontSize: 40, marginBottom: 20 }}>
          Контроль вентиляції
        </h1>

        {loading ? (
          <div>Завантаження...</div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 16,
            }}
          >
            {sensors.map((sensor) => (
              <div
                key={sensor.id}
                style={{
                  background: sensor.online ? "#10214f" : "#5b1d28",
                  borderRadius: 20,
                  padding: 20,
                }}
              >
                <h2 style={{ margin: 0, fontSize: 22 }}>
                  {sensorNames[sensor.id] ?? `Сенсор ${sensor.id}`}
                </h2>

                <div style={{ marginTop: 12, fontSize: 32 }}>
                  {sensor.temp.toFixed(1)}°C
                </div>

                <div style={{ marginTop: 6, opacity: 0.8 }}>
                  RPM: {sensor.rpm}
                </div>

                <div style={{ marginTop: 6, opacity: 0.7 }}>
                  Мін: {sensor.min24}°C | Макс: {sensor.max24}°C
                </div>

                <div style={{ marginTop: 12 }}>
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

                  <Link
                    href={`/fan-settings/${sensor.id}`}
                    style={{
                      display: "inline-block",
                      marginTop: 8,
                      marginLeft: 8,
                      padding: "10px 14px",
                      borderRadius: 12,
                      background: "rgba(34,197,94,0.22)",
                      color: "white",
                      textDecoration: "none",
                      fontWeight: 700,
                    }}
                  >
                    Вентилятор
                  </Link>

                  <Link
                    href={`/chart/${sensor.id}`}
                    style={{
                      display: "inline-block",
                      marginTop: 8,
                      marginLeft: 8,
                      padding: "10px 14px",
                      borderRadius: 12,
                      background: "rgba(125,211,252,0.22)",
                      color: "white",
                      textDecoration: "none",
                      fontWeight: 700,
                    }}
                  >
                    Графік
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}