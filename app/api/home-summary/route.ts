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

    const deviceId = String(sensorId);

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

    return NextResponse.json(
      {
        temp: latest ? Number(latest.temp) : 0,
        updatedAt: latest?.created_at
          ? latest.created_at instanceof Date
            ? latest.created_at.toISOString()
            : new Date(latest.created_at).toISOString()
          : null,
        min24: stats?.min_temp != null ? Number(stats.min_temp) : 0,
        max24: stats?.max_temp != null ? Number(stats.max_temp) : 0,
      },
      {
        headers: {
          "Cache-Control": "no-store",
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
          "