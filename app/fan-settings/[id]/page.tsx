"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type Row = {
  temp: string;
  percent: string;
};

const EMPTY_ROWS = 50;

export default function FanSettingsPage() {
  const { id } = useParams();

  const [startupSeconds, setStartupSeconds] = useState("20");
  const [startupPercent, setStartupPercent] = useState("50");
  const [rows, setRows] = useState<Row[]>(
    Array.from({ length: EMPTY_ROWS }, () => ({ temp: "", percent: "" }))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/fan-profiles?device_id=${id}`, {
          cache: "no-store",
        });
        const data = await res.json();

        setStartupSeconds(String(data.startup_seconds ?? 20));
        setStartupPercent(String(data.startup_percent ?? 50));

        const apiRules = Array.isArray(data.rules) ? data.rules : [];

        setRows(
          Array.from({ length: EMPTY_ROWS }, (_, i) => {
            const rule = apiRules[i];
            return rule
              ? {
                  temp: String(rule.temp),
                  percent: String(rule.percent),
                }
              : { temp: "", percent: "" };
          })
        );
      } catch (error) {
        console.error(error);
        alert("Не вдалося завантажити налаштування");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id]);

  function updateRow(index: number, field: "temp" | "percent", value: string) {
    const next = [...rows];
    next[index] = { ...next[index], [field]: value };
    setRows(next);
  }

  function clearAll() {
    setRows(Array.from({ length: EMPTY_ROWS }, () => ({ temp: "", percent: "" })));
  }

  function setDefault() {
    const defaults: Row[] = [
      { temp: "17", percent: "15" },
      { temp: "18", percent: "20" },
      { temp: "19", percent: "25" },
      { temp: "20", percent: "30" },
      { temp: "21", percent: "35" },
      { temp: "22", percent: "40" },
      { temp: "23", percent: "50" },
      { temp: "24", percent: "55" },
      { temp: "25", percent: "60" },
      { temp: "26", percent: "70" },
      { temp: "27", percent: "75" },
      { temp: "28", percent: "80" },
      { temp: "29", percent: "90" },
      { temp: "30", percent: "100" },
    ];

    setRows(
      Array.from({ length: EMPTY_ROWS }, (_, i) =>
        defaults[i] || { temp: "", percent: "" }
      )
    );
  }

  function validate(validRows: Row[]) {
    const sec = Number(startupSeconds);
    const startup = Number(startupPercent);

    if (!Number.isInteger(sec) || sec < 1 || sec > 300) {
      alert("Час першого запуску має бути від 1 до 300 секунд");
      return false;
    }

    if (!Number.isInteger(startup) || startup < 15 || startup > 100) {
      alert("Відсоток першого запуску має бути від 15 до 100%");
      return false;
    }

    if (validRows.length < 1) {
      alert("Потрібно заповнити хоча б одне правило");
      return false;
    }

    let lastTemp: number | null = null;
    const usedTemps = new Set<number>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const tempFilled = row.temp.trim() !== "";
      const percentFilled = row.percent.trim() !== "";

      if (tempFilled !== percentFilled) {
        alert(`Рядок ${i + 1}: заповни і температуру, і відсоток`);
        return false;
      }

      if (!tempFilled && !percentFilled) continue;

      const temp = Number(row.temp);
      const percent = Number(row.percent);

      if (Number.isNaN(temp)) {
        alert(`Рядок ${i + 1}: температура має бути числом`);
        return false;
      }

      if (!Number.isInteger(percent) || percent < 15 || percent > 100) {
        alert(`Рядок ${i + 1}: відсоток має бути від 15 до 100`);
        return false;
      }

      if (usedTemps.has(temp)) {
        alert(`Рядок ${i + 1}: така температура вже є`);
        return false;
      }

      if (lastTemp !== null && temp <= lastTemp) {
        alert(`Рядок ${i + 1}: температури мають іти по зростанню`);
        return false;
      }

      usedTemps.add(temp);
      lastTemp = temp;
    }

    return true;
  }

  async function save() {
    const validRows = rows.filter(
      (r) => r.temp.trim() !== "" && r.percent.trim() !== ""
    );

    if (!validate(validRows)) return;

    setSaving(true);

    try {
      const res = await fetch("/api/fan-profiles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          device_id: Number(id),
          startup_seconds: Number(startupSeconds),
          startup_percent: Number(startupPercent),
          rules: validRows.map((r) => ({
            temp: Number(r.temp),
            percent: Number(r.percent),
          })),
        }),
      });

      const data = await res.json();

      if (!data.ok) {
        alert(data.error || "Помилка збереження");
        return;
      }

      alert("Налаштування збережено ✅");
    } catch (error) {
      console.error(error);
      alert("Помилка сервера");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main style={{ minHeight: "100vh", background: "#0c1630", color: "white", padding: 20 }}>
        Завантаження...
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0c1630", color: "white", padding: 16 }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <h1 style={{ fontSize: 32, marginBottom: 20 }}>
          Налаштування вентилятора — комп’ютер {id}
        </h1>

        <section style={cardStyle}>
          <h2 style={titleStyle}>Перший запуск</h2>

          <div style={startGridStyle}>
            <label>
              <div style={labelStyle}>Час роботи, секунд</div>
              <input
                value={startupSeconds}
                onChange={(e) => setStartupSeconds(e.target.value)}
                style={inputStyle}
                inputMode="numeric"
              />
            </label>

            <label>
              <div style={labelStyle}>Потужність вентилятора, %</div>
              <input
                value={startupPercent}
                onChange={(e) => setStartupPercent(e.target.value)}
                style={inputStyle}
                inputMode="numeric"
              />
            </label>
          </div>
        </section>

        <section style={cardStyle}>
          <h2 style={titleStyle}>Правила керування температурою</h2>

          <div style={tableHeaderStyle}>
            <div>№</div>
            <div>Температура, °C</div>
            <div>Вентилятор, %</div>
          </div>

          {rows.map((row, i) => (
            <div key={i} style={tableRowStyle}>
              <div style={{ opacity: 0.75 }}>{i + 1}</div>

              <input
                value={row.temp}
                onChange={(e) => updateRow(i, "temp", e.target.value)}
                placeholder="Напр. 22"
                style={inputStyle}
                inputMode="decimal"
              />

              <input
                value={row.percent}
                onChange={(e) => updateRow(i, "percent", e.target.value)}
                placeholder="15–100"
                style={inputStyle}
                inputMode="numeric"
              />
            </div>
          ))}
        </section>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", paddingBottom: 40 }}>
          <button onClick={clearAll} style={{ ...buttonStyle, background: "#a83232" }}>
            Очистити
          </button>

          <button onClick={setDefault} style={{ ...buttonStyle, background: "#2563eb" }}>
            Заводські налаштування
          </button>

          <button
            onClick={save}
            disabled={saving}
            style={{
              ...buttonStyle,
              background: saving ? "#64748b" : "#16a34a",
            }}
          >
            {saving ? "Збереження..." : "Зберегти"}
          </button>
        </div>
      </div>
    </main>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#10214f",
  padding: 18,
  borderRadius: 20,
  marginBottom: 20,
};

const titleStyle: React.CSSProperties = {
  marginTop: 0,
  marginBottom: 16,
  fontSize: 22,
};

const labelStyle: React.CSSProperties = {
  marginBottom: 6,
  fontSize: 14,
  opacity: 0.85,
};

const startGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 14,
};

const tableHeaderStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "60px 1fr 1fr",
  gap: 10,
  padding: "10px 0",
  fontWeight: 800,
  opacity: 0.9,
};

const tableRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "60px 1fr 1fr",
  gap: 10,
  alignItems: "center",
  marginBottom: 8,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "#0b183d",
  color: "white",
  fontSize: 16,
  outline: "none",
};

const buttonStyle: React.CSSProperties = {
  border: 0,
  borderRadius: 14,
  padding: "14px 18px",
  color: "white",
  fontWeight: 800,
  fontSize: 16,
  cursor: "pointer",
};