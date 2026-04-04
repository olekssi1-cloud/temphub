"use client";

import Link from "next/link";

const fakeLogs = [
  {
    start: "02:10",
    end: "02:18",
    duration: "8 хв",
  },
  {
    start: "05:42",
    end: "06:11",
    duration: "29 хв",
  },
  {
    start: "13:00",
    end: "18:05",
    duration: "5 год 5 хв",
  },
];

export default function DisconnectsPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg,#091225,#0c1630)",
        color: "white",
        padding: 20,
      }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <h1 style={{ fontSize: 34, margin: 0 }}>Відключення за 48 годин</h1>

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

        <div style={{ display: "grid", gap: 14 }}>
          {fakeLogs.length === 0 ? (
            <div
              style={{
                background: "#10214f",
                borderRadius: 20,
                padding: 20,
                fontSize: 18,
              }}
            >
              За останні 48 годин відключень не було
            </div>
          ) : (
            fakeLogs.map((log, index) => (
              <div
                key={index}
                style={{
                  background: "#10214f",
                  borderRadius: 20,
                  padding: 20,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 12,
                }}
              >
                <div>Початок: {log.start}</div>
                <div>Кінець: {log.end}</div>
                <div>Тривалість: {log.duration}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}