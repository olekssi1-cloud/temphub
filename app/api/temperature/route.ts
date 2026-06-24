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

    const wifiLevelRaw =
      searchParams.get("wifi_level") || searchParams.get("wifiLevel");

    const wifiRssiRaw =
      searchParams.get("wifi_rssi") || searchParams.get("wifiRssi");

    const coolingRaw = searchParams.get("cooling");

    const deviceIdRaw =
      searchParams.get("device_id") ||
      searchParams.get("deviceId") ||
      searchParams.get("sensorId") ||
      "1";

    const deviceId = String(deviceIdRaw).trim();

    if (!deviceId) {
      return makeJson({ ok: false, error: "Invalid device id" }, 400);
    }

    const temp =
      tempRaw !== null && !Number.isNaN(Number(tempRaw))
        ? Number(tempRaw)
        : null;

    const rpm =
      rpmRaw !== null && !Number.isNaN(Number(rpmRaw))
        ? Math.round(Number(rpmRaw))
        : null;

    const humidity =
      humidityRaw !== null && !Number.isNaN(Number(humidityRaw))
        ? Number(humidityRaw)
        : null;

    const wifiLevel =
      wifiLevelRaw !== null && !Number.isNaN(Number(wifiLevelRaw))
        ? Math.max(0, Math.min(10, Math.round(Number(wifiLevelRaw))))
        : null;

    const wifiRssi =
      wifiRssiRaw !== null && !Number.isNaN(Number(wifiRssiRaw))
        ? Math.round(Number(wifiRssiRaw))
        : null;

    const cooling =
      coolingRaw !== null && !Number.isNaN(Number(coolingRaw))
        ? Number(coolingRaw) === 1
        : null;

    const mode = modeRaw === "manual" || modeRaw === "auto" ? modeRaw : "auto";

    if (tempRaw !== null && temp === null) {
      return makeJson({ ok: false, error: "Invalid temp" }, 400);
    }

    if (wifiLevelRaw !== null && wifiLevel === null) {
      return makeJson({ ok: false, error: "Invalid wifi_level" }, 400);
    }

    if (coolingRaw !== null && cooling === null) {
      return makeJson({ ok: false, error: "Invalid cooling" }, 400);
    }

    if (temp !== null) {
      await sql`
        INSERT INTO temperature_logs (device_id, temp, created_at)
        VALUES (${deviceId}, ${temp}, NOW())
      `;
    }

    if (
      rpm !== null ||
      humidity !== null ||
      mode !== null ||
      wifiLevel !== null ||
      wifiRssi !== null ||
      cooling !== null
    ) {
      await sql`
        INSERT INTO motor_live (
          device_id,
          rpm,
          humidity,
          mode,
          wifi_level,
          wifi_rssi,
          cooling,
          updated_at
        )
        VALUES (
          ${deviceId},
          ${rpm},
          ${humidity},
          ${mode},
          ${wifiLevel},
          ${wifiRssi},
          ${cooling},
          NOW()
        )
        ON CONFLICT (device_id)
        DO UPDATE SET
          rpm = COALESCE(EXCLUDED.rpm, motor_live.rpm),
          humidity = COALESCE(EXCLUDED.humidity, motor_live.humidity),
          mode = COALESCE(EXCLUDED.mode, motor_live.mode),
          wifi_level = COALESCE(EXCLUDED.wifi_level, motor_live.wifi_level),
          wifi_rssi = COALESCE(EXCLUDED.wifi_rssi, motor_live.wifi_rssi),
          cooling = COALESCE(EXCLUDED.cooling, motor_live.cooling),
          updated_at = NOW()
      `;
    }

    if (temp !== null || humidity !== null || rpm !== null) {
      await sql`
        INSERT INTO sensor_history (
          device_id,
          temp,
          humidity,
          rpm,
          mode,
          created_at
        )
        VALUES (
          ${deviceId},
          ${temp},
          ${humidity},
          ${rpm},
          ${mode},
          NOW()
        )
      `;
    }

    return makeJson({
      ok: true,
      status: "ok",
      deviceId,
      temp,
      humidity,
      rpm,
      mode,
      wifiLevel,
      wifiRssi,
      cooling,
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