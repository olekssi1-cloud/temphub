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
    const v = value.trim().toLowerCase();

    if (["1", "true", "on", "yes"].includes(v)) return true;
    if (["0", "false", "off", "no"].includes(v)) return false;
  }

  return null;
}

// ===================== GET =====================
// ESP і сайт читають налаштування охолодження
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const deviceIdRaw =
      searchParams.get("device_id") ||
      searchParams.get("deviceId") ||
      "1";

    const deviceId = String(deviceIdRaw).trim();

    if (!deviceId) {
      return makeJson({ ok: false, error: "Invalid device_id" }, 400);
    }

    const rows = await sql`
      SELECT
        device_id,
        enabled,
        on_temp,
        off_temp,
        min_work_minutes,
        relay_state,
        updated_at
      FROM cooling_settings
      WHERE CAST(device_id AS TEXT) = ${deviceId}
      LIMIT 1
    `;

    // Якщо для цього ESP ще немає налаштувань — створюємо заводські
    if (rows.length === 0) {
      const inserted = await sql`
        INSERT INTO cooling_settings (
          device_id,
          enabled,
          on_temp,
          off_temp,
          min_work_minutes,
          relay_state,
          updated_at
        )
        VALUES (
          ${Number(deviceId)},
          true,
          26.0,
          25.0,
          5,
          false,
          NOW()
        )
        RETURNING
          device_id,
          enabled,
          on_temp,
          off_temp,
          min_work_minutes,
          relay_state,
          updated_at
      `;

      const row = inserted[0];

      return makeJson({
        ok: true,
        device_id: String(row.device_id),
        enabled: Boolean(row.enabled),
        on_temp: Number(row.on_temp),
        off_temp: Number(row.off_temp),
        min_work_minutes: Number(row.min_work_minutes),
        relay_state: Boolean(row.relay_state),
        updated_at: row.updated_at,
      });
    }

    const row = rows[0];

    return makeJson({
      ok: true,
      device_id: String(row.device_id),
      enabled: Boolean(row.enabled),
      on_temp: Number(row.on_temp),
      off_temp: Number(row.off_temp),
      min_work_minutes: Number(row.min_work_minutes),
      relay_state: Boolean(row.relay_state),
      updated_at: row.updated_at,
    });
  } catch (error) {
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
// Сайт зберігає налаштування охолодження.
// ESP також може відправити relay_state, якщо треба оновити тільки стан SSR.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const deviceId = String(body.device_id ?? "").trim();

    if (!deviceId) {
      return makeJson({ ok: false, error: "Invalid device_id" }, 400);
    }

    const relayState = parseBoolean(body.relay_state);

    const hasSettings =
      body.enabled !== undefined ||
      body.on_temp !== undefined ||
      body.off_temp !== undefined ||
      body.min_work_minutes !== undefined;

    // ESP може оновити тільки поточний стан реле без зміни налаштувань
    if (!hasSettings && relayState !== null) {
      const rows = await sql`
        INSERT INTO cooling_settings (
          device_id,
          enabled,
          on_temp,
          off_temp,
          min_work_minutes,
          relay_state,
          updated_at
        )
        VALUES (
          ${Number(deviceId)},
          true,
          26.0,
          25.0,
          5,
          ${relayState},
          NOW()
        )
        ON CONFLICT (device_id)
        DO UPDATE SET
          relay_state = EXCLUDED.relay_state,
          updated_at = NOW()
        RETURNING
          device_id,
          enabled,
          on_temp,
          off_temp,
          min_work_minutes,
          relay_state,
          updated_at
      `;

      const row = rows[0];

      return makeJson({
        ok: true,
        device_id: String(row.device_id),
        enabled: Boolean(row.enabled),
        on_temp: Number(row.on_temp),
        off_temp: Number(row.off_temp),
        min_work_minutes: Number(row.min_work_minutes),
        relay_state: Boolean(row.relay_state),
        updated_at: row.updated_at,
      });
    }

    const enabled = parseBoolean(body.enabled);
    const onTemp = Number(body.on_temp);
    const offTemp = Number(body.off_temp);
    const minWorkMinutes = Number(body.min_work_minutes ?? 5);

    if (enabled === null) {
      return makeJson({ ok: false, error: "Invalid enabled" }, 400);
    }

    if (Number.isNaN(onTemp) || Number.isNaN(offTemp)) {
      return makeJson({ ok: false, error: "Invalid temperature" }, 400);
    }

    if (onTemp <= offTemp) {
      return makeJson(
        {
          ok: false,
          error: "Температура включення має бути більшою за температуру виключення",
        },
        400
      );
    }

    if (onTemp < 0 || onTemp > 60 || offTemp < 0 || offTemp > 60) {
      return makeJson(
        {
          ok: false,
          error: "Температура має бути в межах 0–60°C",
        },
        400
      );
    }

    if (
      !Number.isInteger(minWorkMinutes) ||
      minWorkMinutes < 0 ||
      minWorkMinutes > 120
    ) {
      return makeJson(
        {
          ok: false,
          error: "Мінімальний час роботи має бути від 0 до 120 хв",
        },
        400
      );
    }

    const rows = await sql`
      INSERT INTO cooling_settings (
        device_id,
        enabled,
        on_temp,
        off_temp,
        min_work_minutes,
        relay_state,
        updated_at
      )
      VALUES (
        ${Number(deviceId)},
        ${enabled},
        ${onTemp},
        ${offTemp},
        ${minWorkMinutes},
        ${relayState ?? false},
        NOW()
      )
      ON CONFLICT (device_id)
      DO UPDATE SET
        enabled = EXCLUDED.enabled,
        on_temp = EXCLUDED.on_temp,
        off_temp = EXCLUDED.off_temp,
        min_work_minutes = EXCLUDED.min_work_minutes,
        relay_state = CASE
          WHEN ${relayState}::boolean IS NULL
          THEN cooling_settings.relay_state
          ELSE EXCLUDED.relay_state
        END,
        updated_at = NOW()
      RETURNING
        device_id,
        enabled,
        on_temp,
        off_temp,
        min_work_minutes,
        relay_state,
        updated_at
    `;

    const row = rows[0];

    return makeJson({
      ok: true,
      device_id: String(row.device_id),
      enabled: Boolean(row.enabled),
      on_temp: Number(row.on_temp),
      off_temp: Number(row.off_temp),
      min_work_minutes: Number(row.min_work_minutes),
      relay_state: Boolean(row.relay_state),
      updated_at: row.updated_at,
    });
  } catch (error) {
    return makeJson(
      {
        ok: false,
        error: String(error),
      },
      500
    );
  }
}
