import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const deviceId = searchParams.get("device_id") || "1";
    const tempValue = searchParams.get("temp");

    if (!tempValue) {
      return NextResponse.json(
        { ok: false, error: "Temperature is required" },
        { status: 400 }
      );
    }

    const temp = Number(tempValue);

    if (isNaN(temp)) {
      return NextResponse.json(
        { ok: false, error: "Invalid temperature" },
        { status: 400 }
      );
    }

    await sql`
      INSERT INTO temperature_logs (device_id, temp)
      VALUES (${deviceId}, ${temp})
    `;

    return NextResponse.json({
      ok: true,
      deviceId,
      temp,
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