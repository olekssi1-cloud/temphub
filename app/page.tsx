"use client";

import { useEffect, useState } from "react";

type Sensor = {
  id: number;
  temp: number;
  min24: number;
  max24: number;
  online: boolean;
};

type HomeSummary = {
  sensors: Sensor[];
  onlineCount: number;
  totalCount: number;
};

export default function HomePage() {
  const [data, setData] = useState<HomeSummary | null>(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    const res = await fetch("/api/home-summary");
    const json = await res.json();
    setData(json);
  }

  if (!data) {
    return <div style={{ color: "white", padding: 20 }}>Завантаження...</div>;
  }

  return (
    <main style={{ padding: 20, color: "white" }}>
      <h1>Міщенки</h1>
      <p>
        {data.totalCount} відділів • {data.onlineCount} онлайн
      </p>

      {data.sensors.map((sensor) => (
        <div
          key={sensor.id}
          style={{
            marginTop: 20,
            padding: 20,
            borderRadius: 20,
            background: sensor.online ? "#0b1f5e" : "#3b0f0f",
          }}
        >
          <h2>Супорос {sensor.id}</h2>
          <p>{sensor.temp.toFixed(1)}°C</p>
          <p>
            Min {sensor.min24.toFixed(1)} • Max {sensor.max24.toFixed(1)}
          </p>
          {!sensor.online && <p>Очікує сенсор</p>}
        </div>
      ))}
    </main>
  );
}