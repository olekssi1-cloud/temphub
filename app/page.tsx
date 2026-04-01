"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type LatestData = {
  temp: number | null;
  status: string;
  updatedAt: string | null;
};

type HistoryPoint = {
  temp: number;
  time: string;
};

const ranges = ["1h", "10h", "24h", "5d", "10d"] as const;
type RangeType = (typeof ranges)[number];

function formatTemp(value: number | null) {
  return value !== null && !Number.isNaN(value) ? `${value.toFixed(1)}°C` : "--°C";
}

function formatXAxisLabel(dateString: string, range: RangeType) {
  const date = new Date(dateString);

  if (range === "1h" || range === "10h" || range === "24h") {
    return date.toLocaleTimeString("uk-UA", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Kyiv",
    });
  }

  return date.toLocaleString("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Kyiv",
  });
}

export default function HomePage() {
  const [latest, setLatest] = useState<LatestData | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [range, setRange] = useState<RangeType>("24h");
  const [loadingLatest, setLoadingLatest] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);

  async function loadLatest() {
    try {
      const res = await fetch("/api/latest", { cache: "no-store" });
      const data = await res.json();
      setLatest(data);
    } catch (error) {
      console.error("Latest load error:", error);
    } finally {
      setLoadingLatest(false);
    }
  }

  async function loadHistory(selectedRange: RangeType) {
    try {
      const res = await fetch(`/api/history?range=${selectedRange}`, {
        cache: "no-store",
      });
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("History load error:", error);
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(() => {
    setLoadingLatest(true);
    setLoadingHistory(true);

    loadLatest();
    loadHistory(range);

    const interval = setInterval(() => {
      loadLatest();
      loadHistory(range);
    }, 5000);

    return () => clearInterval(interval);
  }, [range]);

  const last24h = useMemo(() => {
    return history.filter((item) => {
      const t = new Date(item.time).getTime();
      return Date.now() - t <= 24 * 60 * 60 * 1000;
    });
  }, [history]);

  const min24 = useMemo(() => {
    return last24h.length ? Math.min(...last24h.map((x) => x.temp)) : null;
  }, [last24h]);

  const max24 = useMemo(() => {
    return last24h.length ? Math.max(...last24h.map((x) => x.temp)) : null;
  }, [last24h]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#02143a",
        color: "white",
        padding: "24px 16px 48px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <section
          style={{
            background: "linear-gradient(90deg, #2554f4, #22c3e6)",
            borderRadius: 28,
            padding: 24,
            display: "flex",
            gap: 20,
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <div
            style={{
              width: 110,
              height: 110,
              borderRadius: "50%",
              background: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              overflow: "hidden",
            }}
          >
            <Image
              src="/logo.png"
              alt="Logo"
              width={74}
              height={74}
              style={{ objectFit: "contain" }}
            />
          </div>

          <div>
            <h1 style={{ fontSize: 44, margin: 0, fontWeight: 800 }}>Міщенки</h1>
            <p style={{ fontSize: 28, lineHeight: 1.35, margin: "10px 0 0" }}>
              Температура, статус сенсора і межі за 24 години
            </p>
          </div>
        </section>

        <section
          style={{
            background: "#10c433",
            borderRadius: 28,
            padding: 28,
            textAlign: "center",
            marginBottom: 20,
          }}
        >
          <div style={{ fontSize: 92, fontWeight: 800, lineHeight: 1 }}>
            {loadingLatest ? "..." : formatTemp(latest?.temp ?? null)}
          </div>
          <div style={{ fontSize: 32, marginTop: 18 }}>
            {loadingLatest ? "loading" : latest?.status ?? "unknown"}
          </div>
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 20,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              background: "#10c433",
              borderRadius: 28,
              padding: 24,
              textAlign: "center",
              minHeight: 180,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <div style={{ fontSize: 30 }}>MIN 24h</div>
            <div style={{ fontSize: 58, fontWeight: 800, marginTop: 18 }}>
              {loadingHistory ? "..." : formatTemp(min24)}
            </div>
          </div>

          <div
            style={{
              background: "#f30000",
              borderRadius: 28,
              padding: 24,
              textAlign: "center",
              minHeight: 180,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <div style={{ fontSize: 30 }}>MAX 24h</div>
            <div style={{ fontSize: 58, fontWeight: 800, marginTop: 18 }}>
              {loadingHistory ? "..." : formatTemp(max24)}
            </div>
          </div>
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 18,
            marginBottom: 20,
          }}
        >
          {ranges.map((item) => (
            <button
              key={item}
              onClick={() => setRange(item)}
              style={{
                height: 96,
                borderRadius: 24,
                border: "none",
                cursor: "pointer",
                fontSize: 28,
                color: "white",
                background: range === item ? "#2ac4f0" : "#17274d",
              }}
            >
              {item}
            </button>
          ))}
        </section>

        <section
          style={{
            background: "#0b1d4a",
            borderRadius: 28,
            padding: 24,
          }}
        >
          <h2 style={{ fontSize: 34, margin: "0 0 18px", fontWeight: 800 }}>
            Історія температури
          </h2>

          {loadingHistory ? (
            <p style={{ fontSize: 22 }}>Завантаження...</p>
          ) : history.length === 0 ? (
            <p style={{ fontSize: 22 }}>Немає даних для графіка</p>
          ) : (
            <div
              style={{
                display: "grid",
                gap: 12,
              }}
            >
              {history.map((item, index) => (
                <div
                  key={`${item.time}-${index}`}
                  style={{
                    background: "#13295f",
                    borderRadius: 16,
                    padding: "12px 16px",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    fontSize: 20,
                  }}
                >
                  <span>{formatXAxisLabel(item.time, range)}</span>
                  <strong>{item.temp.toFixed(1)}°C</strong>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}