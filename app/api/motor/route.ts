import { sql } from "@vercel/postgres";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const device_id = searchParams.get("device_id");
  const rpm = searchParams.get("rpm");

  if (!device_id || rpm === null) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
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
    success: true,
    device_id,
    rpm: Number(rpm),
  });
}