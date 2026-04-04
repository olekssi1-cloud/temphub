"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type OutageItem = {
  id: string;
  sensorId: number;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  active: boolean;
};

const sensorNames: Record<string, string> = {
  "1": "Опорос",
  "2": "Супорос 1",
  "3": "Супорос 2",
  "4": "Супорос 3",
  "5": "Відгодівля",
  "6": "Дорощювання",
  "7": "Рем свинки",
  "8": "Двір",
};

function formatKyivDateTime(value: string) {
  return new Intl.DateTimeFormat("uk-UA", {
    timeZone: "Europe/Kyiv",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours} год ${minutes} хв`;
  if (minutes > 0) return `${minutes} хв ${seconds} с`;
  return `${seconds} с`;
}

export default function DisconnectsPage() {
  const params = useParams();
  const id = String(params?.id ?? "1");

  const [items, setItems] = useState<OutageItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const res = await fetch(`/api/outages?sensorId=${id}`, {
        cache: "no-store",
      });

      const json = await res.json();

      if (!cancelled) {
        setItems(Array.isArray(json) ? json : []);
        setLoading(false);
      }
    }

    load();

    const timer = setInterval(load, 1000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [id]);

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
          <div>
            <h1 style={{ fontSize: 38, margin: 0 }}>Відключення за 48 годин</h1>
            <div style={{ marginTop: 8, opacity: 0.8 }}>
              {sensorNames[id] ?? `Сенсор ${id}`}
            </div>
          </div>

          <Link
            href="/"
            style={{
              background: "#173a84",
              padding: "12px 18px",
              borderRadius: 14,
              color: "white",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            Назад
          </Link>
        </div>

        {loading ? (
          <div>Завантаження...</div>
        ) : items.length === 0 ? (
          <div
            style={{
              background: "#10214f",
              padding: 20,
              borderRadius: 20,
              fontSize: 18,
            }}
          >
            За останні 48 годин відключень не було
          </div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {items.map((item) => (
              <div
                key={item.id}
                style={{
                  background: item.active ? "#5b1d28" : "#10214f",
                  borderRadius: 20,
                  padding: 20,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 16,
                }}
              >
                <div>
                  <div style={{ opacity: 0.75 }}>Початок</div>
                  <div style={{ fontWeight: 700, marginTop: 6 }}>
                    {formatKyivDateTime(item.startedAt)}
                  </div>
                </div>

                <div>
                  <div style={{ opacity: 0.75 }}>Кінець</div>
                  <div style={{ fontWeight: 700, marginTop: 6 }}>
                    {item.active
                      ? "ще триває"
                      : formatKyivDateTime(item.endedAt!)}
                  </div>
                </div>

                <div>
                  <div style={{ opacity: 0.75 }}>
                    {item.active ? "Триває зараз" : "Тривалість"}
                  </div>
                  <div style={{ fontWeight: 700, marginTop: 6 }}>
                    {formatDuration(item.durationSeconds)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}