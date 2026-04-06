import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function bad(message: string, status = 400) {
  return NextResponse.json(
    { ok: false, error: message },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    }
  );
}

async function handleRequest(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const tempRaw = searchParams.get("temp");
    const deviceIdRaw =
      searchParams.get("device_id") ||
      searchParams.get("sensorId") ||
      searchParams.get("deviceId") ||
      "1";

    if (!tempRaw) {
      return bad("Missing temp");
    }

    const temp = Number(tempRaw);
    if (Number.isNaN(temp)) {
      return bad("Invalid temp");
    }

    const deviceId = String(deviceIdRaw).trim();
    if (!deviceId) {
      return bad("Invalid device_id");
    }

    await sql`
      INSERT INTO temperature_logs (device_id, temp, created_at)
      VALUES (${deviceId}, ${temp}, NOW())
    `;

    const latestRows = await sql`
      SELECT
        device_id,
        temp,
        (created_at AT TIME ZONE 'UTC') AS created_at
      FROM temperature_logs
      WHERE device_id = ${deviceId}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const latest = latestRows[0] ?? null;

    return NextResponse.json(
      {
        ok: true,
        status: "ok",
        deviceId,
        temp: latest ? Number(latest.temp) : temp,
        updatedAt: latest?.created_at
          ? latest.created_at instanceof Date
            ? latest.created_at.toISOString()
            : new Date(latest.created_at).toISOString()
          : new Date().toISOString(),
      },
      {
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: String(error),
      },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}

export async function GET(request: NextRequest) {
  return handleRequest(request);
}