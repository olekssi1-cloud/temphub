import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type TempRow = {
  temp: number;
  created_at: Date | string;
};

const OUTAGE_SECONDS = 180; // 3 хвилини

function toUtcDate(value: Date | string) {
  if (value instanceof Date) return value;
  return new Date(value);
}

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

    const deviceId = String(sensorId);

    const rows = (await sql`
      SELECT
        temp,
        (created_at AT TIME ZONE 'UTC') AS created_at
      FROM temperature_logs
      WHERE device_id = ${deviceId}
        AND created_at >= NOW() - INTERVAL '49 hours'
      ORDER BY created_at ASC
    `) as TempRow[];

    const outages: {
      id: string;
      sensorId: number;
      startedAt: string;
      endedAt: string | null;
      durationSeconds: number;
      active: boolean;
    }[] = [];

    if (!rows.length) {
      return NextResponse.json([], {
        headers: {
          "Cache-Control": "no-store",
        },
      });
    }

    for (let i = 1; i < rows.length; i++) {
      const prev = toUtcDate(rows[i - 1].created_at);
      const curr = toUtcDate(rows[i].created_at);

      const diffSeconds = Math.floor((curr.getTime() - prev.getTime()) / 1000);

      if (diffSeconds > OUTAGE_SECONDS) {
        const startedAt = new Date(prev.getTime() + OUTAGE_SECONDS * 1000);
        const endedAt = curr;

        const durationSeconds = Math.max(
          0,
          Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000)
        );

        outages.push({
          id: `${sensorId}-${startedAt.getTime()}`,
          sensorId,
          startedAt: startedAt.toISOString(),
          endedAt: endedAt.toISOString(),
          durationSeconds,
          active: false,
        });
      }
    }

    const lastSeen = toUtcDate(rows[rows.length - 1].created_at);
    const now = new Date();
    const diffNowSeconds = Math.floor((now.getTime() - lastSeen.getTime()) / 1000);

    if (diffNowSeconds > OUTAGE_SECONDS) {
      const startedAt = new Date(lastSeen.getTime() + OUTAGE_SECONDS * 1000);

      const durationSeconds = Math.max(
        0,
        Math.floor((now.getTime() - startedAt.getTime()) / 1000)
      );

      outages.unshift({
        id: `${sensorId}-active-${startedAt.getTime()}`,
        sensorId,
        startedAt: startedAt.toISOString(),
        endedAt: null,
        durationSeconds,
        active: true,
      });
    }

    const filtered = outages.filter((item) => {
      const started = new Date(item.startedAt).getTime();
      return now.getTime() - started <= 48 * 60 * 60 * 1000;
    });

    return NextResponse.json(filtered, {
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