import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

const RANGE_SQL: Record<string, string> = {
  "1h": "NOW() - INTERVAL '1 hour'",
  "10h": "NOW() - INTERVAL '10 hours'",
  "24h": "NOW() - INTERVAL '24 hours'",
  "5d": "NOW() - INTERVAL '5 days'",
  "10d": "NOW() - INTERVAL '10 days'",
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") || "24h";

    const since = RANGE_SQL[range] || RANGE_SQL["24h"];

    const shortRanges = ["1h", "10h", "24h"];
    const labelFormat = shortRanges.includes(range)
      ? "HH24:MI"
      : "DD.MM HH24:MI";

    const query = `
      SELECT
        temp,
        TO_CHAR(
          ((created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Kyiv'),
          '${labelFormat}'
        ) AS time_label
      FROM temperature_logs
      WHERE created_at >= ${since}
      ORDER BY created_at ASC
      LIMIT 500
    `;

    const rows = (await sql.unsafe(query)) as unknown as any[];

    const result = rows.map((row) => ({
      temp: Number(row.temp),
      time: row.time_label,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("History API error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: String(error),
      },
      { status: 500 }
    );
  }
}