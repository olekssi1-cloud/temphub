import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function makeJson(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

function parseBoolean(value: unknown): boolean | null {
  if (value === true) return true;
  if (value === false) return false;

  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (["1", "true", "on", "yes"].includes(normalized)) {
      return true;
    }

    if (["0", "false", "off", "no"].includes(normalized)) {
      return false;
    }
  }

  return null;
}

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS alarm_settings (
      device_id INTEGER PRIMARY KEY,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      on_temp DOUBLE PRECISION NOT NULL DEFAULT 30.0,
      off_temp DOUBLE PRECISION NOT NULL DEFAULT 29.0,
      alarm_active BOOLEAN NOT NULL DEFAULT FALSE,
      alert_sent BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

function formatRow(row: Record<string, unknown>) {
  return {
    ok: true,
    device_id: String(row.device_id),
    enabled: Boolean(row.enabled),
    on_temp: Number(row.on_temp),
    off_temp: Number(row.off_temp),
    alarm_active: Boolean(row.alarm_active),
    alert_sent: Boolean(row.alert_sent),
    updated_at: row.updated_at,
  };
}

// ===================== GET =====================
// Сайт і сервер читають налаштування сирени конкретного ESP.
export async function GET(request: NextRequest) {
  try {
    await ensureTable();

    const { searchParams } = new URL(request.url);

    const deviceIdRaw =
      searchParams.get("device_id") ||
      searchParams.get("deviceId") ||
      "1";

    const deviceId = Number(String(deviceIdRaw).trim());

    if (!Number.isInteger(deviceId) || deviceId < 1) {
      return makeJson(
        {
          ok: false,
          error: "Invalid device_id",
        },
        400
      );
    }

    const rows = await sql`
      SELECT
        device_id,
        enabled,
        on_temp,
        off_temp,
        alarm_active,
        alert_sent,
        updated_at
      FROM alarm_settings
      WHERE device_id = ${deviceId}
      LIMIT 1
    `;

    // Для нового ESP автоматично створюємо заводські налаштування.
    if (rows.length === 0) {
      const inserted = await sql`
        INSERT INTO alarm_settings (
          device_id,
          enabled,
          on_temp,
          off_temp,
          alarm_active,
          alert_sent,
          updated_at
        )
        VALUES (
          ${deviceId},
          true,
          30.0,
          29.0,
          false,
          false,
          NOW()
        )
        RETURNING
          device_id,
          enabled,
          on_temp,
          off_temp,
          alarm_active,
          alert_sent,
          updated_at
      `;

      return makeJson(formatRow(inserted[0]));
    }

    return makeJson(formatRow(rows[0]));
  } catch (error) {
    console.error("Alarm settings GET error:", error);

    return makeJson(
      {
        ok: false,
        error: String(error),
      },
      500
    );
  }
}

// ===================== POST =====================
// Сайт зберігає пороги сирени.
// Сервер також може окремо оновлювати alarm_active та alert_sent.
export async function POST(request: NextRequest) {
  try {
    await ensureTable();

    const body = await request.json();

    const deviceId = Number(
      String(body.device_id ?? body.deviceId ?? "").trim()
    );

    if (!Number.isInteger(deviceId) || deviceId < 1) {
      return makeJson(
        {
          ok: false,
          error: "Invalid device_id",
        },
        400
      );
    }

    const alarmActive = parseBoolean(body.alarm_active);
    const alertSent = parseBoolean(body.alert_sent);

    const hasSettings =
      body.enabled !== undefined ||
      body.on_temp !== undefined ||
      body.off_temp !== undefined;

    /*
     * Сервер може оновити лише поточний стан тривоги,
     * не змінюючи пороги, встановлені користувачем.
     */
    if (!hasSettings && (alarmActive !== null || alertSent !== null)) {
      const rows = await sql`
        INSERT INTO alarm_settings (
          device_id,
          enabled,
          on_temp,
          off_temp,
          alarm_active,
          alert_sent,
          updated_at
        )
        VALUES (
          ${deviceId},
          true,
          30.0,
          29.0,
          ${alarmActive ?? false},
          ${alertSent ?? false},
          NOW()
        )
        ON CONFLICT (device_id)
        DO UPDATE SET
          alarm_active = CASE
            WHEN ${alarmActive}::boolean IS NULL
            THEN alarm_settings.alarm_active
            ELSE ${alarmActive}
          END,
          alert_sent = CASE
            WHEN ${alertSent}::boolean IS NULL
            THEN alarm_settings.alert_sent
            ELSE ${alertSent}
          END,
          updated_at = NOW()
        RETURNING
          device_id,
          enabled,
          on_temp,
          off_temp,
          alarm_active,
          alert_sent,
          updated_at
      `;

      return makeJson(formatRow(rows[0]));
    }

    const enabled = parseBoolean(body.enabled);
    const onTemp = Number(body.on_temp);
    const offTemp = Number(body.off_temp);

    if (enabled === null) {
      return makeJson(
        {
          ok: false,
          error: "Invalid enabled",
        },
        400
      );
    }

    if (Number.isNaN(onTemp) || Number.isNaN(offTemp)) {
      return makeJson(
        {
          ok: false,
          error: "Температура сирени має бути числом",
        },
        400
      );
    }

    if (onTemp <= offTemp) {
      return makeJson(
        {
          ok: false,
          error:
            "Температура включення сирени має бути більшою за температуру виключення",
        },
        400
      );
    }

    if (
      onTemp < 0 ||
      onTemp > 60 ||
      offTemp < 0 ||
      offTemp > 60
    ) {
      return makeJson(
        {
          ok: false,
          error: "Температура сирени має бути в межах 0–60°C",
        },
        400
      );
    }

    const rows = await sql`
      INSERT INTO alarm_settings (
        device_id,
        enabled,
        on_temp,
        off_temp,
        alarm_active,
        alert_sent,
        updated_at
      )
      VALUES (
        ${deviceId},
        ${enabled},
        ${onTemp},
        ${offTemp},
        ${alarmActive ?? false},
        ${alertSent ?? false},
        NOW()
      )
      ON CONFLICT (device_id)
      DO UPDATE SET
        enabled = EXCLUDED.enabled,
        on_temp = EXCLUDED.on_temp,
        off_temp = EXCLUDED.off_temp,
        alarm_active = CASE
          WHEN ${alarmActive}::boolean IS NULL
          THEN alarm_settings.alarm_active
          ELSE EXCLUDED.alarm_active
        END,
        alert_sent = CASE
          WHEN ${alertSent}::boolean IS NULL
          THEN alarm_settings.alert_sent
          ELSE EXCLUDED.alert_sent
        END,
        updated_at = NOW()
      RETURNING
        device_id,
        enabled,
        on_temp,
        off_temp,
        alarm_active,
        alert_sent,
        updated_at
    `;

    return makeJson(formatRow(rows[0]));
  } catch (error) {
    console.error("Alarm settings POST error:", error);

    return makeJson(
      {
        ok: false,
        error: String(error),
      },
      500
    );
  }
}