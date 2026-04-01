import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS temperature_logs (
        id SERIAL PRIMARY KEY,
        device_id TEXT NOT NULL,
        temp DOUBLE PRECISION NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}