import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function toIso(value: unknown) {
  if (!value) return null;
  return new Date(String(value)).toISOString();
}

export async function GET() {
  try {
    const sensorIds = [1, 2, 3, 4, 5, 6, 7, 8];

    const sensors = await Promise.all(
      sensorIds.map(async (id) => {
        const deviceId = String(id);

        const latestRows = await sql`
          SELECT temp, created_at
          FROM name
          WHERE CAST(device_id AS TEXT) = ${deviceId}
          ORDER BY created_at DESC
          LIMIT 1
        `;

        const statsRows = await sql`
          SELECT
            MIN(temp) AS min_temp,
            MAX(temp) AS max_temp
          FROM name
          WHERE CAST(device_id AS TEXT) = ${deviceId}
            AND created_at >= NOW() - INTERVAL '24 hours'
            AND temp > -100
          LIMIT 1
        `;

        const rpmRows = await sql`
          SELECT rpm, updated_at
          FROM motor_live
          WHERE device_id = ${deviceId}
          LIMIT 1
        `;

        const latest = latestRows[0] ?? null;
        const stats = statsRows[0] ?? null;
        const rpmLive = rpmRows[0] ?? null;

        const updatedAt = toIso(latest?.created_at);

        const online =
          !!updatedAt &&
          Date.now() - new Date(updatedAt).getTime() < 5 * 60 * 1000;

        return {
          id,
          temp: latest ? Number(latest.temp) : 0,
          updatedAt,
          min24: stats?.min_temp != null ? Number(stats.min_temp) : 0,
          max24: stats?.max_temp != null ? Number(stats.max_temp) : 0,
          online,
          rpm: rpmLive?.rpm != null ? Number(rpmLive.rpm) : 0,
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
        ok: false,
        error: String(error),
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  }
}