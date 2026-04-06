import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const sensorIds = [1, 2, 3, 4, 5, 6, 7, 8];

    const sensors = await Promise.all(
      sensorIds.map(async (id) => {
        const latestRows = await sql`
          SELECT
            temp,
            created_at
          FROM temperature_logs
          WHERE device_id::text = ${String(id)}
          ORDER BY created_at DESC
          LIMIT 1
        `;

        const statsRows = await sql`
          SELECT
            MIN(temp) AS min_temp,
            MAX(temp) AS max_temp
          FROM temperature_logs
          WHERE device_id::text = ${String(id)}
            AND created_at >= NOW() - INTERVAL '24 hours'
        `;

        const latest = latestRows[0] ?? null;
        const stats = statsRows[0] ?? null;

        const updatedAt = latest?.created_at
          ? new Date(latest.created_at).toISOString()
          : null;

        const online =
          !!updatedAt &&
          Date.now() - new Date(updatedAt).getTime() < 5 * 60 * 1000;

        return {
          id: String(id),
          temp: latest ? Number(latest.temp) : 0,
          updatedAt,
          min24: stats?.min_temp ? Number(stats.min_temp) : 0,
          max24: stats?.max_temp ? Number(stats.max_temp) : 0,
          online,
        };
      })
    );

    return NextResponse.json(
      {
        sensors,
        onlineCount: sensors.filter((s) => s.online).length,
        totalCount: sensors.length,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "summary failed",
        details: String(error),
      },
      { status: 500 }
    );
  }
}