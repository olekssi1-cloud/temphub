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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const tempRaw = searchParams.get("temp");
    const rpmRaw = searchParams.get("rpm");
    const humidityRaw = searchParams.get("humidity");
    const modeRaw = searchParams.get("mode");

    const deviceIdRaw =
      searchParams.get("device_id") ||
      searchParams.get("deviceId") ||
      searchParams.get("sensorId") ||
      "1";

    const deviceId = String(deviceIdRaw).trim();

    if (!deviceId) {
      return makeJson({ ok: false, error: "Invalid device id" }, 400);
    }

    if (tempRaw !== null) {
      const temp = Number(tempRaw);

      if (Number.isNaN(temp)) {
        return makeJson({ ok: false, error: "Invalid temp" }, 400);
      }

      await sql`
        INSERT INTO temperature_logs (device_id, temp, created_at)
        VALUES (${deviceId}, ${temp}, NOW())
      `;
    }

    const rpm = rpmRaw !== null ? Number(rpmRaw) : null;
    const humidity = humidityRaw !== null ? Number(humidityRaw) : null;
    const mode =
      modeRaw === "manual" || modeRaw === "auto" ? modeRaw : null;

    if (
      (rpm !== null && !Number.isNaN(rpm)) ||
      (humidity !== null && !Number.isNaN(humidity)) ||
      mode !== null
    ) {
      await sql`
        INSERT INTO motor_live (
          device_id,
          rpm,
          humidity,
          mode,
          updated_at
        )
        VALUES (
          ${deviceId},
          ${rpm !== null && !Number.isNaN(rpm) ? Math.round(rpm) : 0},
          ${humidity !== null && !Number.isNaN(humidity) ? humidity : 0},
          ${mode ?? "auto"},
          NOW()
        )
        ON CONFLICT (device_id)
        DO UPDATE SET
          rpm = COALESCE(EXCLUDED.rpm, motor_live.rpm),
          humidity = COALESCE(EXCLUDED.humidity, motor_live.humidity),
          mode = COALESCE(EXCLUDED.mode, motor_live.mode),
          updated_at = NOW()
      `;
    }

    const latestRows = await sql`
      SELECT
        CAST(device_id AS TEXT) AS device_id,
        temp,
        created_at
      FROM temperature_logs
      WHERE CAST(device_id AS TEXT) = ${deviceId}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const latest = latestRows[0] ?? null;

    return makeJson({
      ok: true,
      status: "ok",
      deviceId,
      temp: latest ? Number(latest.temp) : tempRaw ? Number(tempRaw) : null,
      updatedAt: latest?.created_at
        ? new Date(latest.created_at).toISOString()
        : new Date().toISOString(),
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