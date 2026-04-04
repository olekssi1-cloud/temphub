"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const periods = [
  { key: "1h", label: "1 година" },
  { key: "10h", label: "10 годин" },
  { key: "24h", label: "24 години" },
  { key: "3d", label: "3 дні" },
];

export default function ChartPage() {
  const [period, setPeriod] = useState("24h");

  const fakeData = useMemo(() => {
    return Array.from({ length: 40 }, (_, i) => ({
      x: i,
      y: 18 + Math.sin(i / 4) * 3 + i * 0.03,
    }));
  }, [period]);

  const points = fakeData
    .map((p, i) => `${i * 18},${180 - p.y * 5}`)
    .join(" ");

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg,#091225,#0c1630)",
        color: "white",
        padding: 20,
      }}
    >
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <h1 style={{ fontSize: 34, margin: 0 }}>Графік температури</h1>

          <Link
            href="/"
            style={{
              color: "white",
              textDecoration: "none",
              background: "#173a84",
              padding: "10px 16px",
              borderRadius: 12,
            }}
          >
            Назад
          </Link>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            marginBottom: 20,
          }}
        >
          {periods.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              style={{
                border: "none",
                borderRadius: 12,
                padding: "10px 14px",
                cursor: "pointer",
                background: period === p.key ? "#22b8ff" : "#173a84",
                color: "white",
                fontWeight: 700,
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div
          style={{
            background: "#10214f",
            borderRadius: 24,
            padding: 20,
            minHeight: 420,
          }}
        >
          <svg width="100%" height="380" viewBox="0 0 720 200">
            <polyline
              fill="none"
              stroke="#55d8ff"
              strokeWidth="4"
              points={points}
            />
          </svg>
        </div>
      </div>
    </main>
  );
}