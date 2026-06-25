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

        let temp = 0;
        let updatedAt: string | null = null;
        let min24 = 0;
        let max24 = 0;

        let rpm = 0;
        let humidity = 0;
        let mode = "auto";
        let wifiLevel = 0;
        let wifiRssi = 0;

        let cooling = false;
        let coolingEnabled = false;
        let coolingOnTemp = 26;
        let coolingOffTemp = 25;
        let coolingMinWork = 5;

        try {
          const tempRows = await sql`
            SELECT temp, created_at
            FROM temperature_logs
            WHERE CAST(device_id AS TEXT) = ${deviceId}
            ORDER BY created_at DESC
            LIMIT 1
          `;

          if (tempRows.length > 0) {
            temp = Number(tempRows[0].temp);
            updatedAt = tempRows[0].created_at
              ? new Date(tempRows[0].created_at).toISOString()
              : null;
          }

          const statRows = await sql`
            SELECT
              MIN(temp) AS min_temp,
              MAX(temp) AS max_temp
            FROM temperature_logs
            WHERE CAST(device_id AS TEXT) = ${deviceId}
              AND created_at >= NOW() - INTERVAL '24 hours'
          `;

          if (statRows.length > 0) {
            min24 = Number(statRows[0].min_temp ?? 0);
            max24 = Number(statRows[0].max_temp ?? 0);
          }
        } catch (e) {
          console.log("temperature read error", id, e);
        }

        try {
          const motorRows = await sql`
            SELECT rpm, humidity, mode, wifi_level, wifi_rssi, cooling
            FROM motor_live
            WHERE CAST(device_id AS TEXT) = ${deviceId}
            LIMIT 1
          `;

          if (motorRows.length > 0) {
            rpm = Number(motorRows[0].rpm ?? 0);
            humidity = Number(motorRows[0].humidity ?? 0);
            mode = String(motorRows[0].mode ?? "auto");
            wifiLevel = Number(motorRows[0].wifi_level ?? 0);
            wifiRssi = Number(motorRows[0].wifi_rssi ?? 0);
            cooling = Boolean(motorRows[0].cooling ?? false);
          }
        } catch (e) {
          console.log("motor read error", id, e);
        }

        try {
          const coolingRows = await sql`
            SELECT enabled, on_temp, off_temp, relay_state
            FROM cooling_settings
            WHERE CAST(device_id AS TEXT) = ${deviceId}
            LIMIT 1
          `;

          if (coolingRows.length > 0) {
            coolingEnabled = Boolean(coolingRows[0].enabled ?? false);
            coolingOnTemp = Number(coolingRows[0].on_temp ?? 26);
            coolingOffTemp = Number(coolingRows[0].off_temp ?? 25);

            // Якщо ESP ще не передав cooling у motor_live,
            // беремо стан реле з cooling_settings.relay_state.
            if (!cooling) {
              cooling = Boolean(coolingRows[0].relay_state ?? false);
            }
          }
        } catch (e) {
          console.log("cooling read error", id, e);
        }

        const online =
          updatedAt &&
          Date.now() - new Date(updatedAt).getTime() < 5 * 60 * 1000;

        return {
          id,
          temp: online ? temp : 0,
          updatedAt,
          min24: online ? min24 : 0,
          max24: online ? max24 : 0,
          online: !!online,
          rpm: online ? rpm : 0,
          humidity: online ? humidity : 0,
          mode: online ? mode : "auto",

          // Wi-Fi НЕ обнуляємо, навіть якщо ESP офлайн
          wifiLevel,
          wifiRssi,

          // Охолодження
          cooling: online ? cooling : false,
          coolingEnabled,
          coolingOnTemp,
          coolingOffTemp,
          coolingMinWork,
        };
      })
    );

    return NextResponse.json({
      ok: true,
      sensors,
      onlineCount: sensors.filter((s) => s.online).length,
      totalCount: sensors.length,
      coolingCount: sensors.filter((s) => s.cooling).length,
    });
  } catch (error) {
    console.error("home-summary fatal", error);

    return NextResponse.json({
      ok: false,
      error: String(error),
      sensors: [],
      onlineCount: 0,
      totalCount: 8,
      coolingCount: 0,
    });
  }
}
