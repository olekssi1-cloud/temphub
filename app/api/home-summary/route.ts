import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const sensorIds = [1, 2, 3, 4, 5, 6, 7, 8];

    const sensors = await Promise.all(
      sensorIds.map(async (id) => {
        const deviceId = String(id);

        const latestRows = await sql`
          SELECT temp, (created_at AT TIME ZONE 'UTC') AS created_at
          FROM temperature_logs
          WHERE device_id = ${deviceId}
          ORDER BY created_at DESC
          LIMIT 1
        `;

        const statsRows = await sql`
          SELECT
            MIN(temp) AS min_temp,
            MAX(temp) AS max_temp
          FROM temperature_logs
          WHERE device_id = ${deviceId}
            AND created_at >= NOW() - INTERVAL '24 hours'
        `;

        const latest = latestRows?.[0] ?? null;
        const stats = statsRows?.[0] ?? null;

        const updatedAt = latest?.created_at
          ? latest.created_at instanceof Date
            ? latest.created_at.toISOString()
            : new Date(latest.created_at).toISOString()
          : null;

        const online =
          !!updatedAt &&
          Date.now() - new Date(updatedAt).getTime() < 3 * 60 * 1000;

        return {
          id,
          temp: latest ? Number(latest.temp) : 0,
          updatedAt,
          min24: stats?.min_temp != null ? Number(stats.min_temp) : 0,
          max24: stats?.max_temp != null ? Number(stats.max_temp) : 0,
          online,
        };
      })
    );

    return NextResponse.json({
      sensors,
      onlineCount: sensors.filter((s) => s.online).length,
      totalCount: sensors.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: String(error),
      },
      { status: 500 }
    );
  }
}