import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS sensor_outages (
        id SERIAL PRIMARY KEY,
        sensor_id INTEGER NOT NULL,
        started_at TIMESTAMP NOT NULL,
        ended_at TIMESTAMP NOT NULL,
        duration_seconds INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    return NextResponse.json({ ok: true });
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