import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getRangeToInterval(range: string) {
  switch (range) {
    case "1h":
      return "1 hour";
    case "10h":
      return "10 hours";
    case "24h":
      return "24 hours";
    case "3d":
      return "3 days";
    default:
      return "24 hours";
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const range = searchParams.get("range") || "24h";
    const sensorId =
      searchParams.get("sensorId") ||
      searchParams.get("device_id") ||
      "1";

    const intervalValue = getRangeToInterval(range);
    const deviceId = String(sensorId).trim();

    const rows = await sql`
      SELECT temp, created_at
      FROM temperature_logs
      WHERE CAST(device_id AS TEXT) = ${deviceId}
        AND created_at >= NOW() - CAST(${intervalValue} AS interval)
        AND temp > -100
      ORDER BY created_at ASC
    `;

    const data = rows.map((row: any) => ({
      temp: Number(row.temp),
      time:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : new Date(row.created_at).toISOString(),
    }));

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: String(error),
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}