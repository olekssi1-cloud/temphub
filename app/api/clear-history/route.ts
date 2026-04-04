import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await sql`
      DELETE FROM temperature_logs
      WHERE created_at >= NOW() - INTERVAL '49 hours'
    `;

    return NextResponse.json({
      ok: true,
      message: "Історія температур і відключень очищена",
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