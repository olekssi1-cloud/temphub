import { sql } from "@vercel/postgres";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const sensorIds = [1, 2, 3, 4, 5, 6, 7, 8];

    const sensors = await Promise.all(
      sensorIds.map(async (id) => {
        // ✅ беремо останню температуру
        const latestTemp = await sql`
          SELECT temp, updated_at
          FROM sensor_data
          WHERE device_id = ${String(id)}
          ORDER BY updated_at DESC
          LIMIT 1
        `;

        const tempRow = latestTemp.rows[0];

        // ✅ rpm
        const latestMotor = await sql`
          SELECT rpm
          FROM motor_live
          WHERE device_id = ${String(id)}
          LIMIT 1
        `;

        const rpm = Number(latestMotor.rows[0]?.rpm ?? 0);

        // ✅ min/max за 24 години
        const stats = await sql`
          SELECT
            MIN(temp) as min,
            MAX(temp) as max
          FROM sensor_data
          WHERE device_id = ${String(id)}
            AND updated_at > NOW() - INTERVAL '24 HOURS'
        `;

        const stat = stats.rows[0];

        const updatedAt = tempRow?.updated_at ?? null;

        const online = updatedAt
          ? Date.now() - new Date(updatedAt).getTime() < 5 * 60 * 1000
          : false;

        return {
          id,
          temp: Number(tempRow?.temp ?? 0),
          updatedAt,
          min24: Number(stat?.min ?? 0),
          max24: Number(stat?.max ?? 0),
          rpm,
          online,
        };
      })
    );

    return NextResponse.json({
      sensors,
      onlineCount: sensors.filter((s) => s.online).length,
      totalCount: sensorIds.length,
    });
  } catch (error) {
    console.error("home-summary error", error);

    return NextResponse.json({
      sensors: [],
      onlineCount: 0,
      totalCount: 8,
    });
  }
}