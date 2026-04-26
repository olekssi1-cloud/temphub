"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type Row = {
  temp: string;
  percent: string;
};

export default function FanSettingsPage() {
  const { id } = useParams();

  const [startupSeconds, setStartupSeconds] = useState("20");
  const [startupPercent, setStartupPercent] = useState("50");

  const [rows, setRows] = useState<Row[]>(
    Array.from({ length: 50 }, () => ({ temp: "", percent: "" }))
  );

  const [loading, setLoading] = useState(true);

  // ================= LOAD FROM API =================
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/fan-profiles?device_id=${id}`);
        const data = await res.json();

        if (data.exists) {
          setStartupSeconds(String(data.startup_seconds));
          setStartupPercent(String(data.startup_percent));

          const newRows = Array.from({ length: 50 }, (_, i) => {
            const r = data.rules[i];
            return r
              ? { temp: String(r.temp), percent: String(r.percent) }
              : { temp: "", percent: "" };
          });

          setRows(newRows);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id]);

  // ================= UPDATE =================
  function updateRow(index: number, field: "temp" | "percent", value: string) {
    const newRows = [...rows];
    newRows[index][field] = value;
    setRows(newRows);
  }

  function clearAll() {
    setRows(rows.map(() => ({ temp: "", percent: "" })));
  }

  function setDefault() {
    const defaults: Row[] = [
      { temp: "18", percent: "20" },
      { temp: "20", percent: "30" },
      { temp: "22", percent: "40" },
      { temp: "24", percent: "60" },
      { temp: "26", percent: "80" },
      { temp: "28", percent: "100" },
    ];

    const newRows = Array.from({ length: 50 }, (_, i) =>
      defaults[i] || { temp: "", percent: "" }
    );

    setRows(newRows);
  }

  // ================= VALIDATION =================
  function validate(validRows: Row[]) {
    if (validRows.length === 0) {
      alert("Мінімум один рядок");
      return false;
    }

    let lastTemp = -999;

    for (const r of validRows) {
      const temp = Number(r.temp);
      const percent = Number(r.percent);

      if (isNaN(temp)) {
        alert("Температура має бути числом");
        return false;
      }

      if (temp <= lastTemp) {
        alert("Температури мають зростати без повторів");
        return false;
      }

      if (percent < 15 || percent > 100) {
        alert("Швидкість 15–100%");
        return false;
      }

      lastTemp = temp;
    }

    const sec = Number(startupSeconds);
    const perc = Number(startupPercent);

    if (sec < 1 || sec > 300) {
      alert("Старт: 1–300 сек");
      return false;
    }

    if (perc < 15 || perc > 100) {
      alert("Старт %: 15–100");
      return false;
    }

    return true;
  }

  // ================= SAVE =================
  async function save() {
    const validRows = rows.filter(
      (r) => r.temp !== "" && r.percent !== ""
    );

    if (!validate(validRows)) return;

    const payload = {
      device_id: Number(id),
      profile_type: "default",
      startup_seconds: Number(startupSeconds),
      startup_percent: Number(startupPercent),
      rules: validRows.map((r) => ({
        temp: Number(r.temp),
        percent: Number(r.percent),
      })),
    };

    try {
      const res = await fetch("/api/fan-profiles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.ok) {
        alert("Збережено ✅");
      } else {
        alert("Помилка ❌");
      }
    } catch (e) {
      console.error(e);
      alert("Помилка сервера");
    }
  }

  if (loading) return <div style={{ padding: 20 }}>Завантаження...</div>;

  // ================= UI =================
  return (
    <main style={{ minHeight: "100vh", background: "#0c1630", color: "white", padding: 16 }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, marginBottom: 20 }}>
          Налаштування вентилятора (сенсор {id})
        </h1>

        {/* START */}
        <div style={{ background: "#10214f", padding: 16, borderRadius: 16, marginBottom: 20 }}>
          <h2>Перший запуск</h2>

          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <input value={startupSeconds} onChange={(e) => setStartupSeconds(e.target.value)} />
            <input value={startupPercent} onChange={(e) => setStartupPercent(e.target.value)} />
          </div>
        </div>

        {/* TABLE */}
        <div style={{ background: "#10214f", padding: 16, borderRadius: 16, marginBottom: 20 }}>
          <h2>Правила</h2>

          {rows.map((row, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <input value={row.temp} onChange={(e) => updateRow(i, "temp", e.target.value)} />
              <input value={row.percent} onChange={(e) => updateRow(i, "percent", e.target.value)} />
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={clearAll}>Очистити</button>
          <button onClick={setDefault}>Заводські</button>
          <button onClick={save}>Зберегти</button>
        </div>
      </div>
    </main>
  );
}