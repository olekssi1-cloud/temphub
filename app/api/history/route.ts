import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getRangeToInterval(range: string) {
  switch (range) {
    case "12h":
      return "12 hours";
    case "1d":
      return "1 day";
    case "3d":
      return "3 days";

    // старі варіанти залишаємо, щоб нічого не зламати
    case "1h":
      return "1 hour";
    case "10h":
      return "10 hours";
    case "24h":
      return "24 hours";

    default:
      return "12 hours";
  }
}

function makeJson(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const range = searchParams.get("range") || "12h";

    const sensorId =
      searchParams.get("sensorId") ||
      searchParams.get("device_id") ||
      searchParams.get("deviceId") ||
      "1";

    const intervalValue = getRangeToInterval(range);
    const deviceId = String(sensorId).trim();

    if (!deviceId) {
      return makeJson({ ok: false, error: "Invalid device id" }, 400);
    }

    /*
      ВАЖЛИВО:
      Головна сторінка бере актуальну температуру з temperature_logs.
      Тому графік також бере температуру з temperature_logs.
      Вологість і двигун підтягуються з найближчого запису sensor_history.
    */
    const rows = await sql`
      SELECT
        tl.temp AS temp,
        tl.created_at AS created_at,
        sh.humidity AS humidity,
        sh.rpm AS rpm,
        sh.mode AS mode
      FROM temperature_logs tl
      LEFT JOIN LATERAL (
        SELECT
          humidity,
          rpm,
          mode,
          created_at
        FROM sensor_history sh
        WHERE CAST(sh.device_id AS TEXT) = ${deviceId}
          AND sh.created_at >= tl.created_at - INTERVAL '2 minutes'
          AND sh.created_at <= tl.created_at + INTERVAL '2 minutes'
        ORDER BY ABS(EXTRACT(EPOCH FROM (sh.created_at - tl.created_at))) ASC
        LIMIT 1
      ) sh ON true
      WHERE CAST(tl.device_id AS TEXT) = ${deviceId}
        AND tl.created_at >= NOW() - CAST(${intervalValue} AS interval)
      ORDER BY tl.created_at ASC
    `;

    // Якщо temperature_logs порожня — fallback на стару sensor_history
    const fallbackRows =
      rows.length > 0
        ? []
        : await sql`
            SELECT
              temp,
              humidity,
              rpm,
              mode,
              created_at
            FROM sensor_history
            WHERE CAST(device_id AS TEXT) = ${deviceId}
              AND created_at >= NOW() - CAST(${intervalValue} AS interval)
            ORDER BY created_at ASC
          `;

    const sourceRows = rows.length > 0 ? rows : fallbackRows;

    const data = sourceRows.map((row: any) => {
      const mode = row.mode === "manual" ? "manual" : "auto";

      const rpm =
        row.rpm === null || row.rpm === undefined ? null : Number(row.rpm);

      return {
        temp:
          row.temp === null || row.temp === undefined
            ? null
            : Number(row.temp),

        humidity:
          row.humidity === null || row.humidity === undefined
            ? null
            : Number(row.humidity),

        rpm,

        mode,

        motorGraph: mode === "manual" ? 10 : rpm,

        time:
          row.created_at instanceof Date
            ? row.created_at.toISOString()
            : new Date(row.created_at).toISOString(),
      };
    });

    return makeJson(data);
  } catch (error) {
    return makeJson(
      {
        ok: false,
        error: String(error),
      },
      500
    );
  }
}
