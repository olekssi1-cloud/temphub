import { sql } from "@vercel/postgres";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const sensorIds = [1, 2, 3, 4, 5, 6, 7, 8];

    const sensors = await Promise.all(
      sensorIds.map(async (id) => {
        // остання температура
        const latest = await sql`
          SELECT temp, created_at
          FROM temperature_logs
          WHERE device_id = ${id}
          ORDER BY created_at DESC
          LIMIT 1
        `;

        const row = latest.rows[0];

        // min/max за 24 години
        const stats = await sql`
          SELECT
            MIN(temp) as min,
            MAX(temp) as max
          FROM temperature_logs
          WHERE device_id = ${id}
            AND created_at > NOW() - INTERVAL '24 hours'
        `;

        const stat = stats.rows[0];

        // rpm з motor_live
        let rpm = 0;

        try {
          const motor = await sql`
            SELECT rpm
            FROM motor_live
            WHERE device_id = ${String(id)}
            LIMIT 1
          `;

          rpm = Number(motor.rows[0]?.rpm ?? 0);
        } catch {
          rpm = 0;
        }

        const updatedAt = row?.created_at ?? null;

        const online = row
          ? Date.now() - new Date(updatedAt).getTime() < 5 * 60 * 1000
          : false;

        return {
          id,
          temp: Number(row?.temp ?? 0),
          updatedAt,
          min24: Number(stat?.min ?? 0),
          max24: Number(stat?.max ?? 0),
          rpm,
          online,
        };
      })
    );

    const onlineCount = sensors.filter((s) => s.online).length;

    return NextResponse.json({
      sensors,
      onlineCount,
      totalCount: sensorIds.length,
    });
  } catch (error) {
    console.error("home-summary error:", error);

    return NextResponse.json({
      sensors: [],
      onlineCount: 0,
      totalCount: 8,
    });
  }
}