"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

type Row = { temp: string; percent: string };
type Sensor = { id: number; temp: number; rpm: number; online: boolean };

const EMPTY_ROWS = 50;
const sensorNames: Record<string, string> = { "1": "Опорос", "2": "Супорос 1", "3": "Супорос 2", "4": "Супорос 3", "5": "Відгодівля", "6": "Карантин" };

export default function FanRulesEditorPage() {
  const { id } = useParams();
  const router = useRouter();
  const deviceId = String(id ?? "1");

  const [dark, setDark] = useState(false);
  const [startupSeconds, setStartupSeconds] = useState("20");
  const [startupPercent, setStartupPercent] = useState("50");
  const [rows, setRows] = useState<Row[]>(Array.from({ length: EMPTY_ROWS }, () => ({ temp: "", percent: "" })));
  const [sensor, setSensor] = useState<Sensor | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const theme = dark ? darkTheme : lightTheme;

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch(`/api/fan-profiles?device_id=${deviceId}`, { cache: "no-store" });
        const data = await res.json();
        setStartupSeconds(String(data.startup_seconds ?? 20));
        setStartupPercent(String(data.startup_percent ?? 50));
        const apiRules = Array.isArray(data.rules) ? data.rules : [];
        setRows(Array.from({ length: EMPTY_ROWS }, (_, i) => {
          const rule = apiRules[i];
          return rule ? { temp: String(rule.temp), percent: String(rule.percent) } : { temp: "", percent: "" };
        }));
      } catch (error) {
        console.error(error);
        alert("Не вдалося завантажити правила");
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [deviceId]);

  useEffect(() => {
    let cancelled = false;
    async function loadStatus() {
      try {
        const res = await fetch("/api/home-summary", { cache: "no-store" });
        const data = await res.json();
        const found = (data.sensors ?? []).find((s: Sensor) => Number(s.id) === Number(deviceId));
        if (!cancelled) setSensor(found ?? null);
      } catch {
        if (!cancelled) setSensor(null);
      }
    }
    loadStatus();
    const timer = setInterval(loadStatus, 3000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [deviceId]);

  const activeRuleIndex = useMemo(() => {
    const currentTemp = Number(sensor?.temp ?? 0);
    if (!sensor?.online || Number.isNaN(currentTemp)) return -1;
    let active = -1;
    rows.forEach((row, index) => {
      const temp = Number(row.temp);
      const percent = Number(row.percent);
      if (row.temp.trim() !== "" && row.percent.trim() !== "" && !Number.isNaN(temp) && !Number.isNaN(percent) && currentTemp >= temp) active = index;
    });
    return active;
  }, [rows, sensor]);

  const activeRuleText = activeRuleIndex >= 0 ? `${rows[activeRuleIndex]?.temp}°C → ${rows[activeRuleIndex]?.percent}%` : "—";

  function updateRow(index: number, field: "temp" | "percent", value: string) {
    const next = [...rows];
    next[index] = { ...next[index], [field]: value };
    setRows(next);
  }

  function clearAll() { setRows(Array.from({ length: EMPTY_ROWS }, () => ({ temp: "", percent: "" }))); }

  function setDefault() {
    const defaults: Row[] = [
      { temp: "17", percent: "20" }, { temp: "18", percent: "25" }, { temp: "19", percent: "30" },
      { temp: "20", percent: "33" }, { temp: "21", percent: "35" }, { temp: "22", percent: "37" },
      { temp: "23", percent: "45" }, { temp: "24", percent: "47" }, { temp: "25", percent: "50" },
      { temp: "26", percent: "60" }, { temp: "27", percent: "70" }, { temp: "28", percent: "80" },
      { temp: "29", percent: "84" }, { temp: "30", percent: "85" },
    ];
    setRows(Array.from({ length: EMPTY_ROWS }, (_, i) => defaults[i] || { temp: "", percent: "" }));
  }

  function moveRow(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    const temp = next[index];
    next[index] = next[target];
    next[target] = temp;
    setRows(next);
  }

  function copyRow(index: number) {
    const current = rows[index];
    const next = [...rows];
    for (let i = index + 1; i < next.length; i++) {
      if (next[i].temp.trim() === "" && next[i].percent.trim() === "") {
        next[i] = { ...current };
        setRows(next);
        return;
      }
    }
    alert("Немає порожнього рядка для копіювання");
  }

  function deleteRow(index: number) {
    const next = [...rows];
    next[index] = { temp: "", percent: "" };
    setRows(next);
  }

  function validate() {
    let filledCount = 0;
    let lastTemp: number | null = null;
    const usedTemps = new Set<number>();
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const hasTemp = row.temp.trim() !== "";
      const hasPercent = row.percent.trim() !== "";
      if (!hasTemp && !hasPercent) continue;
      if (hasTemp !== hasPercent) { alert(`Рядок ${i + 1}: заповни і температуру, і відсоток`); return false; }
      const temp = Number(row.temp);
      const percent = Number(row.percent);
      if (Number.isNaN(temp)) { alert(`Рядок ${i + 1}: температура має бути числом`); return false; }
      if (!Number.isInteger(percent) || percent < 15 || percent > 100) { alert(`Рядок ${i + 1}: вентилятор має бути від 15 до 100%`); return false; }
      if (usedTemps.has(temp)) { alert(`Рядок ${i + 1}: така температура вже є`); return false; }
      if (lastTemp !== null && temp <= lastTemp) { alert(`Рядок ${i + 1}: температури мають іти по зростанню`); return false; }
      usedTemps.add(temp); lastTemp = temp; filledCount++;
    }
    if (filledCount < 1) { alert("Потрібно заповнити хоча б одне правило"); return false; }
    return true;
  }

  async function save() {
    if (!validate()) return;
    const validRows = rows.filter((r) => r.temp.trim() !== "" && r.percent.trim() !== "").map((r) => ({ temp: Number(r.temp), percent: Number(r.percent) }));
    setSaving(true);
    try {
      const res = await fetch("/api/fan-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_id: Number(deviceId), startup_seconds: Number(startupSeconds), startup_percent: Number(startupPercent), rules: validRows }),
      });
      const data = await res.json();
      if (!data.ok) { alert(data.error || "Помилка збереження"); return; }
      router.push(`/fan-settings/${deviceId}`);
    } catch (error) {
      console.error(error); alert("Помилка сервера");
    } finally { setSaving(false); }
  }

  if (loading) return <main style={{ ...pageStyle, background: theme.bg, color: theme.text }}><div style={screenStyle}>Завантаження...</div></main>;

  return (
    <main style={{ ...pageStyle, background: theme.bg, color: theme.text }}>
      <div style={screenStyle}>
        <header style={headerStyle}>
          <Link href={`/fan-settings/${deviceId}`} style={{ ...backButtonStyle, color: "#2563eb" }}>‹ Назад</Link>
          <div>
            <h1 style={titleStyle}>Правила вентилятора</h1>
            <div style={{ ...subtitleStyle, color: theme.muted }}>{sensorNames[deviceId] ?? `Компʼютер ${deviceId}`}</div>
          </div>
          <button type="button" onClick={() => setDark((v) => !v)} style={{ ...themeButtonStyle, background: theme.card, color: theme.text, borderColor: theme.border }}>{dark ? "🌙" : "☀️"}</button>
        </header>

        <section style={{ ...topInfoCardStyle, background: theme.card, borderColor: theme.border }}>
          <div><span style={{ color: theme.muted, fontWeight: 850 }}>Температура зараз</span><b style={topInfoValueStyle}>{Number(sensor?.temp ?? 0).toFixed(1)}°C</b></div>
          <div><span style={{ color: theme.muted, fontWeight: 850 }}>Активне</span><b style={topInfoValueStyle}>{activeRuleText}{activeRuleIndex >= 0 ? <span style={{ color: "#16a34a" }}> ●</span> : null}</b></div>
        </section>

        <section style={{ ...rulesCardStyle, background: theme.card, borderColor: theme.border }}>
          <div style={{ ...rulesHeaderStyle, background: theme.header, borderColor: theme.border }}>
            <div>№</div><div>Температура</div><div>Вентилятор</div><div>Дії</div>
          </div>

          <div style={rulesScrollStyle}>
            {rows.map((row, i) => {
              const active = i === activeRuleIndex;
              return (
                <div key={i} style={{ ...rulesRowStyle, background: active ? "rgba(22,163,74,0.18)" : "transparent", borderColor: theme.border }}>
                  <div style={{ fontWeight: 950, color: active ? "#16a34a" : theme.text }}>{i + 1}</div>
                  <input value={row.temp} onChange={(e) => updateRow(i, "temp", e.target.value)} placeholder="22" style={{ ...tableInputStyle, background: theme.input, color: theme.text, borderColor: active ? "#22c55e" : theme.border }} inputMode="decimal" />
                  <input value={row.percent} onChange={(e) => updateRow(i, "percent", e.target.value)} placeholder="15–100" style={{ ...tableInputStyle, background: theme.input, color: theme.text, borderColor: active ? "#22c55e" : theme.border }} inputMode="numeric" />
                  <div style={rowActionsStyle}>
                    <button type="button" onClick={() => moveRow(i, -1)} style={tinyButtonStyle}>↑</button>
                    <button type="button" onClick={() => moveRow(i, 1)} style={tinyButtonStyle}>↓</button>
                    <button type="button" onClick={() => copyRow(i)} style={tinyButtonStyle}>⧉</button>
                    <button type="button" onClick={() => deleteRow(i)} style={tinyButtonStyle}>×</button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div style={buttonsRowStyle}>
          <button onClick={clearAll} style={{ ...actionButtonStyle, background: "#dc2626" }}>🗑 Очистити</button>
          <button onClick={setDefault} style={{ ...actionButtonStyle, background: "#2563eb" }}>↻ Заводські</button>
          <button onClick={save} disabled={saving} style={{ ...actionButtonStyle, background: saving ? "#64748b" : "#16a34a" }}>💾 {saving ? "..." : "Зберегти"}</button>
        </div>
      </div>

      <nav style={{ ...bottomNavStyle, background: theme.nav, borderColor: theme.border }}>
        <BottomLink href="/" icon="⌂" text="Головна" active={false} theme={theme} />
        <BottomLink href={`/chart/${deviceId}`} icon="▥" text="Графік" active={false} theme={theme} />
        <BottomLink href={`/fan-settings/${deviceId}`} icon="☷" text="Керування" active theme={theme} />
        <BottomLink href={`/disconnects/${deviceId}`} icon="⚡" text="Відключення" active={false} theme={theme} />
      </nav>
    </main>
  );
}

function BottomLink({ href, icon, text, active, theme }: { href: string; icon: string; text: string; active: boolean; theme: typeof lightTheme }) {
  return <Link href={href} style={{ ...bottomLinkStyle, color: active ? "#2563eb" : theme.muted }}><div style={{ fontSize: 24, lineHeight: 1 }}>{icon}</div><div>{text}</div></Link>;
}

const lightTheme = { bg: "#f8fafc", card: "#ffffff", nav: "#ffffff", text: "#0f172a", muted: "#64748b", border: "#e5e7eb", input: "#ffffff", header: "#f1f5f9" };
const darkTheme = { bg: "#07111f", card: "rgba(15,23,42,0.94)", nav: "rgba(15,23,42,0.98)", text: "#f8fafc", muted: "#cbd5e1", border: "rgba(148,163,184,0.22)", input: "rgba(15,23,42,0.88)", header: "rgba(30,41,59,0.8)" };
const pageStyle: CSSProperties = { height: "100dvh", overflow: "hidden", paddingBottom: 76 };
const screenStyle: CSSProperties = { height: "calc(100dvh - 76px)", maxWidth: 560, margin: "0 auto", padding: "8px 10px", display: "flex", flexDirection: "column", overflow: "hidden" };
const headerStyle: CSSProperties = { display: "grid", gridTemplateColumns: "74px 1fr 50px", alignItems: "center", gap: 8, marginBottom: 7, flex: "0 0 auto" };
const backButtonStyle: CSSProperties = { textDecoration: "none", fontWeight: 900, fontSize: 15 };
const titleStyle: CSSProperties = { margin: 0, fontSize: "clamp(20px,5vw,26px)", fontWeight: 950, lineHeight: 1.05, textAlign: "center" };
const subtitleStyle: CSSProperties = { marginTop: 3, fontSize: 14, fontWeight: 800, textAlign: "center" };
const themeButtonStyle: CSSProperties = { height: 44, borderRadius: 14, border: "1px solid", fontSize: 21 };
const topInfoCardStyle: CSSProperties = { border: "1px solid", borderRadius: 15, padding: "8px 10px", marginBottom: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, flex: "0 0 auto" };
const topInfoValueStyle: CSSProperties = { display: "block", marginTop: 4, fontSize: 17, fontWeight: 950 };
const rulesCardStyle: CSSProperties = { border: "1px solid", borderRadius: 18, overflow: "hidden", boxShadow: "0 8px 22px rgba(15,23,42,0.06)", flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column" };
const rulesHeaderStyle: CSSProperties = { display: "grid", gridTemplateColumns: "34px 1fr 1fr 92px", padding: "8px 5px", borderBottom: "1px solid", fontSize: 11, fontWeight: 950, textAlign: "center", flex: "0 0 auto" };
const rulesScrollStyle: CSSProperties = { flex: "1 1 auto", minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch" };
const rulesRowStyle: CSSProperties = { display: "grid", gridTemplateColumns: "34px 1fr 1fr 92px", alignItems: "center", gap: 4, padding: "4px 5px", borderBottom: "1px solid" };
const tableInputStyle: CSSProperties = { width: "100%", boxSizing: "border-box", border: "1px solid", borderRadius: 9, padding: "7px 5px", fontSize: 15, fontWeight: 900, textAlign: "center", outline: "none" };
const rowActionsStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2 };
const tinyButtonStyle: CSSProperties = { border: "1px solid rgba(148,163,184,0.35)", borderRadius: 8, background: "rgba(148,163,184,0.12)", color: "inherit", fontWeight: 950, padding: "6px 0", fontSize: 12 };
const buttonsRowStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 8, flex: "0 0 auto" };
const actionButtonStyle: CSSProperties = { border: 0, borderRadius: 13, padding: "11px 4px", color: "white", fontSize: "clamp(11px,3.1vw,14px)", fontWeight: 950 };
const bottomNavStyle: CSSProperties = { position: "fixed", left: 0, right: 0, bottom: 0, maxWidth: 560, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", borderTop: "1px solid", padding: "7px 4px 9px", zIndex: 50 };
const bottomLinkStyle: CSSProperties = { textAlign: "center", textDecoration: "none", fontSize: 12, fontWeight: 850 };
