"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

type Row = {
  temp: string;
  percent: string;
};

type Sensor = {
  id: number;
  temp: number;
  humidity: number;
  rpm: number;
  mode: string;
  online: boolean;
  cooling?: boolean;
  wifiLevel?: number;
  wifi_level?: number;
};

const EMPTY_ROWS = 50;

const sensorNames: Record<string, string> = {
  "1": "Опорос",
  "2": "Супорос 1",
  "3": "Супорос 2",
  "4": "Супорос 3",
  "5": "Відгодівля",
  "6": "Карантин",
};

export default function FanSettingsPage() {
  const { id } = useParams();
  const deviceId = String(id ?? "1");

  const [dark, setDark] = useState(false);

  const [startupSeconds, setStartupSeconds] = useState("20");
  const [startupPercent, setStartupPercent] = useState("50");

  const [coolingEnabled, setCoolingEnabled] = useState(true);
  const [coolingOnTemp, setCoolingOnTemp] = useState("26");
  const [coolingOffTemp, setCoolingOffTemp] = useState("25");
  const [coolingMinWork, setCoolingMinWork] = useState("5");

  const [alarmEnabled, setAlarmEnabled] = useState(true);
  const [alarmOnTemp, setAlarmOnTemp] = useState("30");
  const [alarmOffTemp, setAlarmOffTemp] = useState("29");

  const [rows, setRows] = useState<Row[]>(
    Array.from(
      { length: EMPTY_ROWS },
      () => ({
        temp: "",
        percent: "",
      })
    )
  );

  const [sensor, setSensor] = useState<Sensor | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const theme = dark ? darkTheme : lightTheme;

  useEffect(() => {
    async function loadAll() {
      setLoading(true);

      try {
        const fanRes = await fetch(
          `/api/fan-profiles?device_id=${deviceId}`,
          {
            cache: "no-store",
          }
        );

        const fanData = await fanRes.json();

        setStartupSeconds(
          String(fanData.startup_seconds ?? 20)
        );

        setStartupPercent(
          String(fanData.startup_percent ?? 50)
        );

        const apiRules = Array.isArray(fanData.rules)
          ? fanData.rules
          : [];

        setRows(
          Array.from(
            { length: EMPTY_ROWS },
            (_, index) => {
              const rule = apiRules[index];

              return rule
                ? {
                    temp: String(rule.temp),
                    percent: String(rule.percent),
                  }
                : {
                    temp: "",
                    percent: "",
                  };
            }
          )
        );

        try {
          const coolingRes = await fetch(
            `/api/cooling-settings?device_id=${deviceId}`,
            {
              cache: "no-store",
            }
          );

          const cooling = await coolingRes.json();

          if (cooling?.ok !== false) {
            setCoolingEnabled(
              cooling.enabled ?? true
            );

            setCoolingOnTemp(
              String(cooling.on_temp ?? 26)
            );

            setCoolingOffTemp(
              String(cooling.off_temp ?? 25)
            );

            setCoolingMinWork(
              String(cooling.min_work_minutes ?? 5)
            );
          }
        } catch (error) {
          console.error(
            "Cooling settings load error:",
            error
          );
        }

        try {
          const alarmRes = await fetch(
            `/api/alarm-settings?device_id=${deviceId}`,
            {
              cache: "no-store",
            }
          );

          const alarm = await alarmRes.json();

          if (alarm?.ok !== false) {
            setAlarmEnabled(
              alarm.enabled ?? true
            );

            setAlarmOnTemp(
              String(alarm.on_temp ?? 30)
            );

            setAlarmOffTemp(
              String(alarm.off_temp ?? 29)
            );
          }
        } catch (error) {
          console.error(
            "Alarm settings load error:",
            error
          );
        }
      } catch (error) {
        console.error(error);

        alert(
          "Не вдалося завантажити налаштування"
        );
      } finally {
        setLoading(false);
      }
    }

    loadAll();
  }, [deviceId]);

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      try {
        const res = await fetch(
          "/api/home-summary",
          {
            cache: "no-store",
          }
        );

        const data = await res.json();

        const found = (
          data.sensors ?? []
        ).find(
          (currentSensor: Sensor) =>
            Number(currentSensor.id) ===
            Number(deviceId)
        );

        if (!cancelled) {
          setSensor(found ?? null);
        }
      } catch {
        if (!cancelled) {
          setSensor(null);
        }
      }
    }

    loadStatus();

    const timer = setInterval(
      loadStatus,
      3000
    );

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [deviceId]);

  const filledRulesCount = useMemo(() => {
    return rows.filter(
      (row) =>
        row.temp.trim() !== "" &&
        row.percent.trim() !== ""
    ).length;
  }, [rows]);

  const activeRuleIndex = useMemo(() => {
    const currentTemp = Number(
      sensor?.temp ?? 0
    );

    if (
      !sensor?.online ||
      Number.isNaN(currentTemp)
    ) {
      return -1;
    }

    let active = -1;

    rows.forEach((row, index) => {
      const temp = Number(row.temp);
      const percent = Number(row.percent);

      if (
        row.temp.trim() !== "" &&
        row.percent.trim() !== "" &&
        !Number.isNaN(temp) &&
        !Number.isNaN(percent) &&
        currentTemp >= temp
      ) {
        active = index;
      }
    });

    return active;
  }, [rows, sensor]);

  const activeRuleText = useMemo(() => {
    if (activeRuleIndex < 0) {
      return "—";
    }

    const rule = rows[activeRuleIndex];

    if (!rule) {
      return "—";
    }

    return `${rule.temp}°C → ${rule.percent}%`;
  }, [activeRuleIndex, rows]);

  function clearAll() {
    setRows(
      Array.from(
        { length: EMPTY_ROWS },
        () => ({
          temp: "",
          percent: "",
        })
      )
    );
  }

  function setDefault() {
    const defaults: Row[] = [
      { temp: "17", percent: "20" },
      { temp: "18", percent: "25" },
      { temp: "19", percent: "30" },
      { temp: "20", percent: "33" },
      { temp: "21", percent: "35" },
      { temp: "22", percent: "37" },
      { temp: "23", percent: "45" },
      { temp: "24", percent: "47" },
      { temp: "25", percent: "50" },
      { temp: "26", percent: "60" },
      { temp: "27", percent: "70" },
      { temp: "28", percent: "80" },
      { temp: "29", percent: "84" },
      { temp: "30", percent: "85" },
    ];

    setRows(
      Array.from(
        { length: EMPTY_ROWS },
        (_, index) =>
          defaults[index] || {
            temp: "",
            percent: "",
          }
      )
    );
  }

  function validateFanSettings() {
    const seconds = Number(startupSeconds);
    const startup = Number(startupPercent);

    if (
      !Number.isInteger(seconds) ||
      seconds < 1 ||
      seconds > 300
    ) {
      alert(
        "Час першого запуску має бути від 1 до 300 секунд"
      );

      return false;
    }

    if (
      !Number.isInteger(startup) ||
      startup < 15 ||
      startup > 100
    ) {
      alert(
        "Потужність першого запуску має бути від 15 до 100%"
      );

      return false;
    }

    let filledCount = 0;
    let lastTemp: number | null = null;

    const usedTemps = new Set<number>();

    for (
      let index = 0;
      index < rows.length;
      index++
    ) {
      const row = rows[index];

      const hasTemp =
        row.temp.trim() !== "";

      const hasPercent =
        row.percent.trim() !== "";

      if (!hasTemp && !hasPercent) {
        continue;
      }

      if (hasTemp !== hasPercent) {
        alert(
          `Рядок ${index + 1}: заповни і температуру, і відсоток`
        );

        return false;
      }

      const temp = Number(row.temp);
      const percent = Number(row.percent);

      if (Number.isNaN(temp)) {
        alert(
          `Рядок ${index + 1}: температура має бути числом`
        );

        return false;
      }

      if (
        !Number.isInteger(percent) ||
        percent < 15 ||
        percent > 100
      ) {
        alert(
          `Рядок ${index + 1}: вентилятор має бути від 15 до 100%`
        );

        return false;
      }

      if (usedTemps.has(temp)) {
        alert(
          `Рядок ${index + 1}: така температура вже є`
        );

        return false;
      }

      if (
        lastTemp !== null &&
        temp <= lastTemp
      ) {
        alert(
          `Рядок ${index + 1}: температури мають іти по зростанню`
        );

        return false;
      }

      usedTemps.add(temp);
      lastTemp = temp;
      filledCount++;
    }

    if (filledCount < 1) {
      alert(
        "Потрібно заповнити хоча б одне правило"
      );

      return false;
    }

    return true;
  }

  function validateCoolingSettings() {
    const onTemp = Number(coolingOnTemp);
    const offTemp = Number(coolingOffTemp);
    const minWork = Number(coolingMinWork);

    if (
      Number.isNaN(onTemp) ||
      Number.isNaN(offTemp)
    ) {
      alert(
        "Температура охолодження має бути числом"
      );

      return false;
    }

    if (onTemp <= offTemp) {
      alert(
        "Температура включення охолодження має бути більшою за температуру виключення"
      );

      return false;
    }

    if (
      onTemp < 0 ||
      onTemp > 60 ||
      offTemp < 0 ||
      offTemp > 60
    ) {
      alert(
        "Температура охолодження має бути в межах 0–60°C"
      );

      return false;
    }

    if (
      !Number.isInteger(minWork) ||
      minWork < 0 ||
      minWork > 120
    ) {
      alert(
        "Мінімальний час роботи має бути від 0 до 120 хвилин"
      );

      return false;
    }

    return true;
  }

  function validateAlarmSettings() {
    const onTemp = Number(alarmOnTemp);
    const offTemp = Number(alarmOffTemp);

    if (
      Number.isNaN(onTemp) ||
      Number.isNaN(offTemp)
    ) {
      alert(
        "Температура сирени має бути числом"
      );

      return false;
    }

    if (onTemp <= offTemp) {
      alert(
        "Температура включення сирени має бути більшою за температуру виключення"
      );

      return false;
    }

    if (
      onTemp < 0 ||
      onTemp > 60 ||
      offTemp < 0 ||
      offTemp > 60
    ) {
      alert(
        "Температура сирени має бути в межах 0–60°C"
      );

      return false;
    }

    return true;
  }

  async function save() {
    if (!validateFanSettings()) {
      return;
    }

    if (!validateCoolingSettings()) {
      return;
    }

    if (!validateAlarmSettings()) {
      return;
    }

    const validRows = rows
      .filter(
        (row) =>
          row.temp.trim() !== "" &&
          row.percent.trim() !== ""
      )
      .map((row) => ({
        temp: Number(row.temp),
        percent: Number(row.percent),
      }));

    setSaving(true);

    try {
      const fanRes = await fetch(
        "/api/fan-profiles",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            device_id: Number(deviceId),
            startup_seconds:
              Number(startupSeconds),
            startup_percent:
              Number(startupPercent),
            rules: validRows,
          }),
        }
      );

      const fanData =
        await fanRes.json();

      if (!fanData.ok) {
        alert(
          fanData.error ||
            "Помилка збереження вентилятора"
        );

        return;
      }

      const coolingRes = await fetch(
        "/api/cooling-settings",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            device_id: Number(deviceId),
            enabled: coolingEnabled,
            on_temp:
              Number(coolingOnTemp),
            off_temp:
              Number(coolingOffTemp),
            min_work_minutes:
              Number(coolingMinWork),
          }),
        }
      );

      const coolingData =
        await coolingRes.json();

      if (!coolingData.ok) {
        alert(
          coolingData.error ||
            "Помилка збереження охолодження"
        );

        return;
      }

      const alarmRes = await fetch(
        "/api/alarm-settings",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            device_id: Number(deviceId),
            enabled: alarmEnabled,
            on_temp:
              Number(alarmOnTemp),
            off_temp:
              Number(alarmOffTemp),
          }),
        }
      );

      const alarmData =
        await alarmRes.json();

      if (!alarmData.ok) {
        alert(
          alarmData.error ||
            "Помилка збереження сирени"
        );

        return;
      }

      alert(
        "Налаштування збережено ✅"
      );
    } catch (error) {
      console.error(error);

      alert("Помилка сервера");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main
        style={{
          ...pageStyle,
          background: theme.bg,
          color: theme.text,
        }}
      >
        <div style={screenStyle}>
          Завантаження...
        </div>
      </main>
    );
  }

  const wifiLevel =
    sensor?.wifiLevel ??
    sensor?.wifi_level ??
    0;

  const fanValue =
    sensor?.mode === "manual"
      ? "Ручне"
      : `${Math.round(sensor?.rpm ?? 0)}%`;

  const coolingStatus =
    sensor?.cooling ? "ON" : "OFF";

  return (
    <main
      style={{
        ...pageStyle,
        background: theme.bg,
        color: theme.text,
      }}
    >
      <div style={screenStyle}>
        <header style={headerStyle}>
          <button
            style={{
              ...menuButtonStyle,
              color: theme.text,
            }}
          >
            ☰
          </button>

          <div>
            <h1 style={titleStyle}>
              Керування вентиляцією
            </h1>

            <div
              style={{
                ...subtitleStyle,
                color: theme.muted,
              }}
            >
              {sensorNames[deviceId] ??
                `Компʼютер ${deviceId}`}
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              setDark((value) => !value)
            }
            style={{
              ...themeButtonStyle,
              background: theme.card,
              color: theme.text,
              borderColor: theme.border,
            }}
          >
            {dark ? "🌙" : "☀️"}
          </button>
        </header>

        <section
          style={{
            ...cardStyle,
            background: theme.card,
            borderColor: theme.border,
          }}
        >
          <div style={cardTitleRowStyle}>
            <h2 style={cardTitleStyle}>
              Стан компʼютера
            </h2>

            <span
              style={{
                ...onlineBadgeStyle,
                background: sensor?.online
                  ? "rgba(22,163,74,0.16)"
                  : "rgba(220,38,38,0.14)",
                color: sensor?.online
                  ? "#16a34a"
                  : "#dc2626",
              }}
            >
              ●{" "}
              {sensor?.online
                ? "Онлайн"
                : "Офлайн"}
            </span>
          </div>

          <div style={statusGridStyle}>
            <StatusItem
              icon="📶"
              label="Wi-Fi"
              value={`${wifiLevel}/10`}
              theme={theme}
            />

            <StatusItem
              icon="🌡"
              label="Темп."
              value={`${Number(
                sensor?.temp ?? 0
              ).toFixed(1)}°`}
              theme={theme}
            />

            <StatusItem
              icon="💧"
              label="Волог."
              value={`${Number(
                sensor?.humidity ?? 0
              ).toFixed(0)}%`}
              theme={theme}
            />

            <StatusItem
              icon="🌀"
              label="Вент."
              value={fanValue}
              theme={theme}
            />

            <StatusItem
              icon="❄️"
              label="Охол."
              value={coolingStatus}
              theme={theme}
            />
          </div>
        </section>

        <section
          style={{
            ...smallCardStyle,
            background: theme.card,
            borderColor: theme.border,
          }}
        >
          <h2 style={cardTitleStyle}>
            ⚡ Перший запуск після зміни правил
          </h2>

          <div style={simpleRowStyle}>
            <span>Час роботи</span>

            <input
              value={startupSeconds}
              onChange={(event) =>
                setStartupSeconds(
                  event.target.value
                )
              }
              style={{
                ...smallInputStyle,
                background: theme.input,
                color: theme.text,
                borderColor: theme.border,
              }}
              inputMode="numeric"
            />

            <b>сек</b>
          </div>

          <div style={simpleRowStyle}>
            <span>Потужність</span>

            <input
              value={startupPercent}
              onChange={(event) =>
                setStartupPercent(
                  event.target.value
                )
              }
              style={{
                ...smallInputStyle,
                background: theme.input,
                color: theme.text,
                borderColor: theme.border,
              }}
              inputMode="numeric"
            />

            <b>%</b>
          </div>
        </section>

        <section
          style={{
            ...smallCardStyle,
            background: theme.card,
            borderColor: theme.border,
          }}
        >
          <h2 style={cardTitleStyle}>
            ❄️ Система охолодження
          </h2>

          <div style={coolingGridStyle}>
            <div style={coolingLabelStyle}>
              Увімкнено
            </div>

            <div
              style={{
                ...coolingTopLabelStyle,
                color: theme.muted,
              }}
            >
              Вкл
            </div>

            <div
              style={{
                ...coolingTopLabelStyle,
                color: theme.muted,
              }}
            >
              Викл
            </div>

            <div
              style={{
                ...coolingTopLabelStyle,
                color: theme.muted,
              }}
            >
              Хв
            </div>

            <label style={checkboxWrapStyle}>
              <input
                type="checkbox"
                checked={coolingEnabled}
                onChange={(event) =>
                  setCoolingEnabled(
                    event.target.checked
                  )
                }
                style={checkboxStyle}
              />
            </label>

            <input
              value={coolingOnTemp}
              onChange={(event) =>
                setCoolingOnTemp(
                  event.target.value
                )
              }
              style={{
                ...smallInputStyle,
                background: theme.input,
                color: theme.text,
                borderColor: theme.border,
              }}
              inputMode="decimal"
            />

            <input
              value={coolingOffTemp}
              onChange={(event) =>
                setCoolingOffTemp(
                  event.target.value
                )
              }
              style={{
                ...smallInputStyle,
                background: theme.input,
                color: theme.text,
                borderColor: theme.border,
              }}
              inputMode="decimal"
            />

            <input
              value={coolingMinWork}
              onChange={(event) =>
                setCoolingMinWork(
                  event.target.value
                )
              }
              style={{
                ...smallInputStyle,
                background: theme.input,
                color: theme.text,
                borderColor: theme.border,
              }}
              inputMode="numeric"
            />
          </div>

          <div
            style={{
              ...alarmDividerStyle,
              borderColor: theme.border,
            }}
          />

          <div style={alarmGridStyle}>
            <div style={alarmLabelStyle}>
              🚨 Сирена
            </div>

            <div
              style={{
                ...coolingTopLabelStyle,
                color: theme.muted,
              }}
            >
              Увімк.
            </div>

            <div
              style={{
                ...coolingTopLabelStyle,
                color: theme.muted,
              }}
            >
              Вкл
            </div>

            <div
              style={{
                ...coolingTopLabelStyle,
                color: theme.muted,
              }}
            >
              Викл
            </div>

            <div
              style={{
                ...alarmHintStyle,
                color: theme.muted,
              }}
            >
              Температурна
            </div>

            <label style={checkboxWrapStyle}>
              <input
                type="checkbox"
                checked={alarmEnabled}
                onChange={(event) =>
                  setAlarmEnabled(
                    event.target.checked
                  )
                }
                style={{
                  ...checkboxStyle,
                  accentColor: "#dc2626",
                }}
              />
            </label>

            <input
              value={alarmOnTemp}
              onChange={(event) =>
                setAlarmOnTemp(
                  event.target.value
                )
              }
              style={{
                ...smallInputStyle,
                background: theme.input,
                color: theme.text,
                borderColor: theme.border,
              }}
              inputMode="decimal"
            />

            <input
              value={alarmOffTemp}
              onChange={(event) =>
                setAlarmOffTemp(
                  event.target.value
                )
              }
              style={{
                ...smallInputStyle,
                background: theme.input,
                color: theme.text,
                borderColor: theme.border,
              }}
              inputMode="decimal"
            />
          </div>
        </section>

        <section
          style={{
            ...rulesSummaryCardStyle,
            background: theme.card,
            borderColor: theme.border,
          }}
        >
          <h2 style={cardTitleStyle}>
            📋 Правила вентилятора
          </h2>

          <div style={rulesSummaryGridStyle}>
            <div style={rulesSummaryItemStyle}>
              <div
                style={{
                  ...rulesSummaryLabelStyle,
                  color: theme.muted,
                }}
              >
                Всього правил
              </div>

              <div style={rulesSummaryValueStyle}>
                {filledRulesCount}
              </div>
            </div>

            <div style={rulesSummaryItemStyle}>
              <div
                style={{
                  ...rulesSummaryLabelStyle,
                  color: theme.muted,
                }}
              >
                Активне правило

                {activeRuleIndex >= 0 ? (
                  <span style={greenDotStyle}>
                    ●
                  </span>
                ) : null}
              </div>

              <div style={rulesSummaryValueStyle}>
                {activeRuleText}
              </div>
            </div>

            <Link
              href={`/fan-settings/${deviceId}/rules`}
              style={openEditorButtonStyle}
            >
              ✏️ Редагувати →
            </Link>
          </div>
        </section>

        <div style={buttonsRowStyle}>
          <button
            onClick={clearAll}
            style={{
              ...actionButtonStyle,
              background: "#dc2626",
            }}
          >
            🗑 Очистити
          </button>

          <button
            onClick={setDefault}
            style={{
              ...actionButtonStyle,
              background: "#2563eb",
            }}
          >
            ↻ Заводські
          </button>

          <button
            onClick={save}
            disabled={saving}
            style={{
              ...actionButtonStyle,
              background: saving
                ? "#64748b"
                : "#16a34a",
            }}
          >
            💾 {saving ? "..." : "Зберегти"}
          </button>
        </div>
      </div>

      <nav
        style={{
          ...bottomNavStyle,
          background: theme.nav,
          borderColor: theme.border,
        }}
      >
        <BottomLink
          href="/"
          icon="⌂"
          text="Головна"
          active={false}
          theme={theme}
        />

        <BottomLink
          href={`/chart/${deviceId}`}
          icon="▥"
          text="Графік"
          active={false}
          theme={theme}
        />

        <BottomLink
          href={`/fan-settings/${deviceId}`}
          icon="☷"
          text="Керування"
          active
          theme={theme}
        />

        <BottomLink
          href={`/disconnects/${deviceId}`}
          icon="⚡"
          text="Відключення"
          active={false}
          theme={theme}
        />
      </nav>
    </main>
  );
}

function StatusItem({
  icon,
  label,
  value,
  theme,
}: {
  icon: string;
  label: string;
  value: string;
  theme: typeof lightTheme;
}) {
  return (
    <div
      style={{
        ...statusItemStyle,
        borderColor: theme.border,
      }}
    >
      <div style={statusIconStyle}>
        {icon}
      </div>

      <div
        style={{
          ...statusLabelStyle,
          color: theme.muted,
        }}
      >
        {label}
      </div>

      <div style={statusValueStyle}>
        {value}
      </div>
    </div>
  );
}

function BottomLink({
  href,
  icon,
  text,
  active,
  theme,
}: {
  href: string;
  icon: string;
  text: string;
  active: boolean;
  theme: typeof lightTheme;
}) {
  return (
    <Link
      href={href}
      style={{
        ...bottomLinkStyle,
        color: active
          ? "#2563eb"
          : theme.muted,
      }}
    >
      <div
        style={{
          fontSize: 24,
          lineHeight: 1,
        }}
      >
        {icon}
      </div>

      <div>{text}</div>
    </Link>
  );
}

const lightTheme = {
  bg: "#f8fafc",
  card: "#ffffff",
  nav: "#ffffff",
  text: "#0f172a",
  muted: "#64748b",
  border: "#e5e7eb",
  input: "#ffffff",
  header: "#f1f5f9",
};

const darkTheme = {
  bg: "#07111f",
  card: "rgba(15,23,42,0.94)",
  nav: "rgba(15,23,42,0.98)",
  text: "#f8fafc",
  muted: "#cbd5e1",
  border: "rgba(148,163,184,0.22)",
  input: "rgba(15,23,42,0.88)",
  header: "rgba(30,41,59,0.8)",
};

const pageStyle: CSSProperties = {
  height: "100dvh",
  overflow: "hidden",
  paddingBottom: 76,
};

const screenStyle: CSSProperties = {
  height: "calc(100dvh - 76px)",
  maxWidth: 560,
  margin: "0 auto",
  padding: "8px 10px 18px",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  overflowX: "hidden",
  overflowY: "auto",
  WebkitOverflowScrolling: "touch",
};

const headerStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "42px 1fr 50px",
  alignItems: "center",
  gap: 8,
  marginBottom: 7,
  flex: "0 0 auto",
};

const menuButtonStyle: CSSProperties = {
  border: 0,
  background: "transparent",
  fontSize: 31,
  fontWeight: 900,
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: "clamp(21px,5.3vw,28px)",
  fontWeight: 950,
  lineHeight: 1.05,
};

const subtitleStyle: CSSProperties = {
  marginTop: 3,
  fontSize: 15,
  fontWeight: 800,
};

const themeButtonStyle: CSSProperties = {
  height: 44,
  borderRadius: 14,
  border: "1px solid",
  fontSize: 21,
};

const cardStyle: CSSProperties = {
  border: "1px solid",
  borderRadius: 18,
  padding: 10,
  marginBottom: 8,
  boxShadow:
    "0 8px 22px rgba(15,23,42,0.06)",
  flex: "0 0 auto",
};

const smallCardStyle: CSSProperties = {
  border: "1px solid",
  borderRadius: 18,
  padding: 10,
  marginBottom: 8,
  boxShadow:
    "0 8px 22px rgba(15,23,42,0.06)",
  flex: "0 0 auto",
};

const rulesSummaryCardStyle: CSSProperties = {
  border: "1px solid",
  borderRadius: 18,
  padding: 10,
  marginBottom: 8,
  boxShadow:
    "0 8px 22px rgba(15,23,42,0.06)",
  flex: "0 0 auto",
};

const cardTitleRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  marginBottom: 8,
};

const cardTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "clamp(15px,4vw,19px)",
  fontWeight: 950,
  lineHeight: 1.1,
};

const onlineBadgeStyle: CSSProperties = {
  padding: "4px 9px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const statusGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, 1fr)",
};

const statusItemStyle: CSSProperties = {
  textAlign: "center",
  borderLeft: "1px solid",
  padding: "2px 2px",
};

const statusIconStyle: CSSProperties = {
  fontSize: 22,
  lineHeight: 1,
};

const statusLabelStyle: CSSProperties = {
  marginTop: 4,
  fontSize: 10,
  fontWeight: 800,
};

const statusValueStyle: CSSProperties = {
  marginTop: 4,
  fontSize: "clamp(12px,3.3vw,17px)",
  fontWeight: 950,
};

const simpleRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 72px 28px",
  alignItems: "center",
  gap: 7,
  padding: "6px 0",
  borderBottom:
    "1px solid rgba(148,163,184,0.22)",
  fontWeight: 800,
};

const smallInputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid",
  borderRadius: 10,
  padding: "6px 8px",
  fontSize: 15,
  fontWeight: 900,
  textAlign: "center",
};

const coolingGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "1.15fr 0.8fr 0.8fr 0.8fr",
  gap: 7,
  alignItems: "center",
  marginTop: 8,
};

const coolingLabelStyle: CSSProperties = {
  fontWeight: 900,
  fontSize: 13,
};

const coolingTopLabelStyle: CSSProperties = {
  textAlign: "center",
  fontWeight: 900,
  fontSize: 12,
};

const checkboxWrapStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const checkboxStyle: CSSProperties = {
  width: 26,
  height: 26,
  accentColor: "#2563eb",
};

const alarmDividerStyle: CSSProperties = {
  borderTop: "1px solid",
  marginTop: 9,
  paddingTop: 1,
};

const alarmGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "1.15fr 0.8fr 0.8fr 0.8fr",
  gap: 7,
  alignItems: "center",
  marginTop: 7,
};

const alarmLabelStyle: CSSProperties = {
  fontWeight: 950,
  fontSize: 13,
};

const alarmHintStyle: CSSProperties = {
  fontWeight: 800,
  fontSize: 10,
};

const rulesSummaryGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "0.9fr 1.2fr 1.15fr",
  gap: 8,
  alignItems: "center",
  marginTop: 9,
};

const rulesSummaryItemStyle: CSSProperties = {
  borderRight:
    "1px solid rgba(148,163,184,0.22)",
  minHeight: 48,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
};

const rulesSummaryLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 850,
  marginBottom: 4,
};

const rulesSummaryValueStyle: CSSProperties = {
  fontSize: "clamp(15px,4.2vw,19px)",
  fontWeight: 950,
};

const greenDotStyle: CSSProperties = {
  color: "#16a34a",
  marginLeft: 5,
};

const openEditorButtonStyle: CSSProperties = {
  background: "#2563eb",
  color: "white",
  borderRadius: 13,
  padding: "10px 8px",
  textDecoration: "none",
  textAlign: "center",
  fontWeight: 950,
  fontSize: "clamp(12px,3.3vw,15px)",
};

const buttonsRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(3, 1fr)",
  gap: 8,
  marginTop: 1,
  flex: "0 0 auto",
};

const actionButtonStyle: CSSProperties = {
  border: 0,
  borderRadius: 13,
  padding: "11px 4px",
  color: "white",
  fontSize: "clamp(11px,3.1vw,14px)",
  fontWeight: 950,
};

const bottomNavStyle: CSSProperties = {
  position: "fixed",
  left: 0,
  right: 0,
  bottom: 0,
  maxWidth: 560,
  margin: "0 auto",
  display: "grid",
  gridTemplateColumns:
    "repeat(4, 1fr)",
  borderTop: "1px solid",
  padding: "7px 4px 9px",
  zIndex: 50,
};

const bottomLinkStyle: CSSProperties = {
  textAlign: "center",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 850,
};