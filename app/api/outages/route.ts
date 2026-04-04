import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sensorId = Number(searchParams.get("sensorId") || "1");

    if (Number.isNaN(sensorId) || sensorId < 1) {
      return NextResponse.json(
        { ok: false, error: "Invalid sensorId" },
        { status: 400 }
      );
    }

    await sql`
      DELETE FROM sensor_outages
      WHERE created_at < NOW() - INTERVAL '48 hours'
    `;

    const rows = await sql`
      SELECT
        id,
        sensor_id,
        started_at,
        ended_at,
        duration_seconds
      FROM sensor_outages
      WHERE sensor_id = ${sensorId}
      ORDER BY started_at DESC
    `;

    const data = rows.map((row: any) => ({
      id: row.id,
      sensorId: Number(row.sensor_id),
      startedAt:
        row.started_at instanceof Date
          ? row.started_at.toISOString()
          : new Date(row.started_at).toISOString(),
      endedAt:
        row.ended_at instanceof Date
          ? row.ended_at.toISOString()
          : new Date(row.ended_at).toISOString(),
      durationSeconds: Number(row.duration_seconds),
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