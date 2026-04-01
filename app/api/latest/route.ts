import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const rows = await sql`
      SELECT temp, created_at
      FROM temperature_logs
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const data = rows;

    if (!data.length) {
      return NextResponse.json(
        {
          temp: null,
          status: "no_data",
          updatedAt: null,
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const row = data[0];

    return NextResponse.json(
      {
        temp: Number(row.temp),
        status: "ok",
        updatedAt: row.created_at,
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
        temp: null,
        status: "error",
        updatedAt: null,
        message: String(error),
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