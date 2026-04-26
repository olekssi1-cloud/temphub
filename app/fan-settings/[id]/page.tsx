"use client";

import { useParams } from "next/navigation";
import { useState } from "react";

type Row = {
  temp: string;
  percent: string;
};

export default function FanSettingsPage() {
  const { id } = useParams();

  // ===== START SETTINGS =====
  const [startupSeconds, setStartupSeconds] = useState("20");
  const [startupPercent, setStartupPercent] = useState("50");

  // ===== 50 ROWS =====
  const [rows, setRows] = useState<Row[]>(
    Array.from({ length: 50 }, () => ({
      temp: "",
      percent: "",
    }))
  );

  // ===== HANDLERS =====
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

  function save() {
    const validRows = rows.filter(
      (r) => r.temp !== "" && r.percent !== ""
    );

    if (validRows.length === 0) {
      alert("Потрібно заповнити хоча б один рядок");
      return;
    }

    alert("Налаштування збережено (поки без БД)");
    console.log({
      sensorId: id,
      startupSeconds,
      startupPercent,
      rules: validRows,
    });
  }

  // ===== UI =====
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0c1630",
        color: "white",
        padding: 16,
      }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, marginBottom: 20 }}>
          Налаштування вентилятора (сенсор {id})
        </h1>

        {/* START SETTINGS */}
        <div
          style={{
            background: "#10214f",
            padding: 16,
            borderRadius: 16,
            marginBottom: 20,
          }}
        >
          <h2>Перший запуск</h2>

          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <input
              value={startupSeconds}
              onChange={(e) => setStartupSeconds(e.target.value)}
              placeholder="Секунди"
              style={{ padding: 10, borderRadius: 10, width: 120 }}
            />

            <input
              value={startupPercent}
              onChange={(e) => setStartupPercent(e.target.value)}
              placeholder="%"
              style={{ padding: 10, borderRadius: 10, width: 100 }}
            />
          </div>
        </div>

        {/* TABLE */}
        <div
          style={{
            background: "#10214f",
            padding: 16,
            borderRadius: 16,
            marginBottom: 20,
          }}
        >
          <h2>Правила (температура → %)</h2>

          <div style={{ marginTop: 10 }}>
            {rows.map((row, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                  marginBottom: 6,
                }}
              >
                <input
                  value={row.temp}
                  onChange={(e) =>
                    updateRow(i, "temp", e.target.value)
                  }
                  placeholder="Температура"
                  style={{ padding: 8, borderRadius: 8 }}
                />

                <input
                  value={row.percent}
                  onChange={(e) =>
                    updateRow(i, "percent", e.target.value)
                  }
                  placeholder="% вентилятора"
                  style={{ padding: 8, borderRadius: 8 }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* BUTTONS */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={clearAll}
            style={{
              padding: "12px 16px",
              borderRadius: 12,
              background: "#aa2e2e",
              color: "white",
              fontWeight: 700,
            }}
          >
            Очистити
          </button>

          <button
            onClick={setDefault}
            style={{
              padding: "12px 16px",
              borderRadius: 12,
              background: "#2e7aaa",
              color: "white",
              fontWeight: 700,
            }}
          >
            Заводські
          </button>

          <button
            onClick={save}
            style={{
              padding: "12px 16px",
              borderRadius: 12,
              background: "#2eaa5a",
              color: "white",
              fontWeight: 700,
            }}
          >
            Зберегти
          </button>
        </div>
      </div>
    </main>
  );
}