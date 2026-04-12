import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const sensorIds = [1, 2, 3, 4, 5, 6, 7, 8];

    const sensors = await Promise.all(
      sensorIds.map(async (id) => {
        let temp = 0;
        let updatedAt: string | null = null;
        let min24 = 0;
        let max24 = 0;
        let rpm = 0;

        // ===== TEMPERATURE =====
        try {
          const tempRows = await sql`
            SELECT temp, updated_at
            FROM sensor_data
            WHERE device_id = ${String(id)}
            ORDER BY updated_at DESC
            LIMIT 1
          `;

          if (tempRows.length > 0) {
            temp = Number(tempRows[0].temp);
            updatedAt = tempRows[0].updated_at
              ? new Date(tempRows[0].updated_at).toISOString()
              : null;
          }

          const statRows = await sql`
            SELECT
              MIN(temp) as min_temp,
              MAX(temp) as max_temp
            FROM sensor_data
            WHERE device_id = ${String(id)}
              AND updated_at >= NOW() - INTERVAL '24 hours'
          `;

          if (statRows.length > 0) {
            min24 = Number(statRows[0].min_temp ?? 0);
            max24 = Number(statRows[0].max_temp ?? 0);
          }
        } catch (e) {
          console.log("temp read error", id, e);
        }

        // ===== MOTOR =====
        try {
          const motorRows = await sql`
            SELECT rpm
            FROM motor_live
            WHERE device_id = ${String(id)}
            LIMIT 1
          `;

          if (motorRows.length > 0) {
            rpm = Number(motorRows[0].rpm ?? 0);
          }
        } catch (e) {
          console.log("rpm read error", id, e);
        }

        const online =
          updatedAt &&
          Date.now() - new Date(updatedAt).getTime() < 5 * 60 * 1000;

        return {
          id,
          temp,
          updatedAt,
          min24,
          max24,
          online: !!online,
          rpm,
        };
      })
    );

    return NextResponse.json({
      sensors,
      onlineCount: sensors.filter((s) => s.online).length,
      totalCount: sensors.length,
    });
  } catch (error) {
    console.error("home-summary fatal", error);
    return NextResponse.json({
      sensors: [],
      onlineCount: 0,
      totalCount: 8,
      error: String(error),
    });
  }
}