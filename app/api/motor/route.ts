import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const device_id = searchParams.get("device_id");
    const rpm = searchParams.get("rpm");

    if (!device_id || rpm === null) {
      return NextResponse.json(
        { ok: false, error: "Missing params" },
        { status: 400 }
      );
    }

    await sql`
      INSERT INTO motor_live (device_id, rpm, updated_at)
      VALUES (${device_id}, ${Number(rpm)}, NOW())
      ON CONFLICT (device_id)
      DO UPDATE SET
        rpm = EXCLUDED.rpm,
        updated_at = NOW()
    `;

    return NextResponse.json({
      ok: true,
      device_id,
      rpm: Number(rpm),
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