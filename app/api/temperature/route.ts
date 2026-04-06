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
    const deviceIdRaw =
      searchParams.get("device_id") ||
      searchParams.get("deviceId") ||
      searchParams.get("sensorId") ||
      "1";

    if (!tempRaw) {
      return makeJson({ ok: false, error: "Missing temp" }, 400);
    }

    const temp = Number(tempRaw);
    if (Number.isNaN(temp)) {
      return makeJson({ ok: false, error: "Invalid temp" }, 400);
    }

    const deviceId = String(deviceIdRaw).trim();
    if (!deviceId) {
      return makeJson({ ok: false, error: "Invalid device id" }, 400);
    }

    await sql`
      INSERT INTO temperature_logs (device_id, temp, created_at)
      VALUES (${deviceId}, ${temp}, NOW())
    `;

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
      temp: latest ? Number(latest.temp) : temp,
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